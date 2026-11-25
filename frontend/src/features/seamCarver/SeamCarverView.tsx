import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, ButtonGroup, Form } from 'react-bootstrap';
import { drawPixels, Pixels } from './engine/decode';
import { SeamDirection, ViewLayer } from './engine/protocol';
import { afterStep, frameShows, nextSeam, seamPath, Size } from './seamView';
import { useSeamView } from './useSeamView';

const formatSize = (width: number, height: number) => `${width} × ${height} px`;

// Matches the visitor's "reduce motion" setting as it changes (false where matchMedia is missing)
export function usePrefersReducedMotion(): boolean {
    const query = () => window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const [reduce, setReduce] = useState(() => !!query()?.matches);
    useEffect(() => {
        const list = query();
        if (!list) return;
        const update = () => setReduce(list.matches);
        update();
        list.addEventListener('change', update);
        return () => list.removeEventListener('change', update);
    }, []);
    return reduce;
}

const LAYERS: { layer: ViewLayer, label: string }[] = [
    { layer: 'image', label: 'Image' },
    { layer: 'energy', label: 'Energy' },
];

type Props = {
    image: Pixels,
    // The size the form asks for, if the image can be carved to it
    target: Size | undefined,
    makeWorker?: () => Worker,
};

// Steps through the carve of the chosen image to the target, a seam at a time, on the Rust engine
// (its energy map and seams are the original Java's): the image or its energy map, the seam the
// next step removes, Step, and Play (a step per animation frame; hidden for reduced motion).
// A new image or target starts again from the input.
export default function SeamCarverView({ image, target: typed, makeWorker }: Props) {
    const { frame, error, busy, request, restart, restartIfStepped, discard } = useSeamView(makeWorker);
    // The page makes a new target object every render: this one changes only with the size, so Play's
    // animation frame isn't cancelled and asked again on every re-render
    const target = useMemo(() => typed, [typed?.width, typed?.height]); // eslint-disable-line react-hooks/exhaustive-deps
    const [layer, setLayer] = useState<ViewLayer>('image');
    const [showSeam, setShowSeam] = useState(false);
    const [playing, setPlaying] = useState(false);
    const reduceMotion = usePrefersReducedMotion();
    const canvas = useRef<HTMLCanvasElement>(null);

    // A new image needs a new worker; a new target the same image from the start, once seams have
    // been removed (before that, the frame already shown still holds: typing a size sends nothing)
    useEffect(() => {
        discard();
        setPlaying(false);
    }, [image, discard]);
    useEffect(() => {
        restartIfStepped();
        setPlaying(false);
    }, [target, restartIfStepped]);
    useEffect(() => {
        if (reduceMotion) setPlaying(false);
    }, [reduceMotion]);

    // Until the worker's first frame, the input as it is
    const shown: Pixels = frame ? { width: frame.width, height: frame.height, rgb: frame.pixels } : image;
    const size = { width: shown.width, height: shown.height };
    const next = nextSeam(size, target);
    const wantedSeam = showSeam ? next : undefined;

    useEffect(() => {
        if (canvas.current) drawPixels(canvas.current, shown);
    }, [shown.rgb]); // eslint-disable-line react-hooks/exhaustive-deps

    const step = useCallback((direction: SeamDirection) => {
        const seam = showSeam ? nextSeam(afterStep(size, direction), target) : undefined;
        request(image, { layer, seam }, direction);
    }, [image, layer, showSeam, request, size.width, size.height, target]); // eslint-disable-line react-hooks/exhaustive-deps

    // Keeps the frame in step with the controls (Play's steps carry them, so not while playing; nor
    // after an error, until the visitor acts again)
    useEffect(() => {
        if (busy || playing || error) return;
        if (!frameShows(frame, layer, wantedSeam)) request(image, { layer, seam: wantedSeam });
    }, [busy, playing, error, frame, layer, wantedSeam, image, request]);

    // Play: the next step once the last one's frame is in, at most one per animation frame
    useEffect(() => {
        if (!playing || busy) return;
        if (!next || error) {
            setPlaying(false);
            return;
        }
        const id = requestAnimationFrame(() => step(next));
        return () => cancelAnimationFrame(id);
    }, [playing, busy, next, error, step]);

    const atTarget = !!target && !next;
    const removed = frame?.removed ?? 0;
    const status = !target
        ? 'Choose a target size above to step through its seams.'
        : `${formatSize(size.width, size.height)}, ${removed} ${removed === 1 ? 'seam' : 'seams'} removed. `
            + (atTarget ? 'At the target size.' : `Next: a ${next} seam.`);
    const seam = showSeam && frame?.seam && frameShows(frame, layer, wantedSeam) ? frame.seam : undefined;
    // What the canvas shows, which lags the controls until the frame asked for comes in
    const label = (frame?.layer === 'energy' ? 'Energy map' : 'Image being carved')
        + `, ${formatSize(size.width, size.height)}`;

    return (
        <section aria-labelledby="seamCarverViewHeading" className="mt-4">
            <h2 id="seamCarverViewHeading">Step through the carve</h2>
            <div className="d-flex flex-wrap align-items-center mb-2">
                <ButtonGroup aria-label="Show" className="mb-2">
                    {LAYERS.map(option => (
                        <Button
                            key={option.layer}
                            variant={layer === option.layer ? 'primary' : 'secondary'}
                            aria-pressed={layer === option.layer}
                            onClick={() => {
                                if (error) restart();
                                setLayer(option.layer);
                            }}
                        >
                            {option.label}
                        </Button>
                    ))}
                </ButtonGroup>
                <Form.Check
                    type="switch"
                    id="seamCarverShowSeam"
                    label="Show the next seam"
                    className="mb-2 mx-3"
                    checked={showSeam}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                        if (error) restart();
                        setShowSeam(event.target.checked);
                    }}
                />
                <div className="mb-2">
                    <Button variant="secondary" disabled={!next || busy || playing} onClick={() => next && step(next)}>
                        Step
                    </Button>{' '}
                    {!reduceMotion &&
                        <><Button variant="secondary" disabled={!next && !playing} onClick={() => setPlaying(!playing)}>
                            {playing ? 'Pause' : 'Play'}
                        </Button>{' '}</>
                    }
                    <Button variant="secondary" disabled={!frame?.removed} onClick={() => {
                        setPlaying(false);
                        restart();
                    }}>
                        Start over
                    </Button>
                </div>
            </div>
            <p aria-live={playing ? 'off' : 'polite'} id="seamCarverViewStatus">{status}</p>
            {error && <Alert variant="danger">{error}</Alert>}
            <div style={{ position: 'relative', maxWidth: 640 }}>
                <canvas
                    ref={canvas}
                    role="img"
                    aria-label={label}
                    aria-describedby="seamCarverViewStatus"
                    style={{ display: 'block', width: '100%', imageRendering: 'pixelated' }}
                />
                {seam &&
                    <svg
                        data-testid="seamCarverNextSeam"
                        aria-hidden="true"
                        viewBox={`0 0 ${size.width} ${size.height}`}
                        preserveAspectRatio="none"
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                    >
                        {/* The stroke keeps a seam visible where the image is drawn smaller than its pixels */}
                        <path d={seamPath(seam)} fill="red" stroke="red" strokeWidth={1.5} vectorEffect="non-scaling-stroke"/>
                    </svg>
                }
            </div>
        </section>
    );
}
