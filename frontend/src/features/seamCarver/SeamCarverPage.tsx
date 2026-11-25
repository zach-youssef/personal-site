import React, { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Alert, Button, Col, Container, Form, Image as Img, ProgressBar, Row } from 'react-bootstrap';
import { useForm, ValidateResult } from 'react-hook-form'
import { SiteText, SiteTextContents } from '../../content/text/SiteText';
import { decodePixels, drawPixels, Pixels } from './engine/decode';
import { chooseEngine, estimateSeconds, JAVA_MAX_PIXELS, SLOW_SECONDS } from './engine/estimate';
import { engineOf, Variant, VARIANTS } from './engine/protocol';
import { CarveRequest, CarveResult, useSeamCarver } from './useSeamCarver';

type FormValues = {
    file: FileList,
    height: string,
    width: string
};

// The chosen image: decoded to pixels once, and shown from an object URL that its owner revokes
type ChosenImage = Pixels & { url: string, name: string };

const formatSize = (width: number, height: number) => `${width} × ${height} px`;

// A duration for the visitor: tenths of a second when short, whole seconds, then minutes
export function formatDuration(seconds: number): string {
    if (seconds < 10) return `${Math.max(seconds, 0.1).toFixed(1)} s`;
    if (seconds < 90) return `${Math.round(seconds)} s`;
    return `${Math.round(seconds / 60)} min`;
}

const text = (key: SiteText, values: Record<string, string> = {}) =>
    SiteTextContents[key].replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);

const CARVED_BY: { [variant in Variant]: SiteText } = {
    'java-wasm': SiteText.SeamCarverCarvedByJavaWasm,
    'java-js': SiteText.SeamCarverCarvedByJavaJs,
    'rust': SiteText.SeamCarverCarvedByRust,
};

// For the e2e only: ?engine=java-wasm|java-js|rust makes every carve use that variant
function forcedVariant(): Variant | undefined {
    const value = new URLSearchParams(window.location.search).get('engine');
    return VARIANTS.find(variant => variant === value);
}

// Resolves with the decoded image, or undefined (revoking the URL) if the browser can't decode it
async function chooseImage(file: File): Promise<ChosenImage | undefined> {
    const url = URL.createObjectURL(file);
    try {
        return { ...await decodePixels(file), url, name: file.name };
    } catch {
        URL.revokeObjectURL(url);
        return undefined;
    }
}

function CarvedImage({ result, name }: { result: CarveResult, name: string }) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const [download, setDownload] = useState<string>();

    useEffect(() => {
        if (!canvas.current) return;
        drawPixels(canvas.current, result);
        // Encoded by the worker from the pixels, not read back from the canvas, which some browsers
        // add noise to
        const url = URL.createObjectURL(new Blob([result.png as Uint8Array<ArrayBuffer>], { type: 'image/png' }));
        setDownload(url);
        return () => {
            URL.revokeObjectURL(url);
            setDownload(undefined);
        };
    }, [result]);

    const baseName = name.replace(/\.[^.]*$/, '');
    return (
        <>
            {result.reranAfterOutOfMemory &&
                <Alert variant="info">{text(SiteText.SeamCarverJavaRanOutOfMemory)}</Alert>
            }
            <canvas
                ref={canvas}
                role="img"
                aria-label={`Carved image, ${formatSize(result.width, result.height)}`}
                style={{ maxWidth: '100%' }}
            />
            <p id="seamCarverEngineUsed">
                {text(CARVED_BY[result.variant])}, in {formatDuration(result.ms / 1000)}.
            </p>
            {download &&
                <p><a href={download} download={`${baseName}-${result.width}x${result.height}.png`}>Download PNG</a></p>
            }
        </>
    );
}

function SeamCarverPage() {
    const { register, handleSubmit, formState: { errors }, setValue, trigger, clearErrors, watch } = useForm<FormValues>();
    const { state, carve, cancel } = useSeamCarver();

    // The chosen file's decode, which every validator awaits rather than decoding the file again;
    // undefined while no file is chosen
    const decoding = useRef<Promise<ChosenImage | undefined>>();
    const [chosen, setChosen] = useState<ChosenImage>();
    const [preferFast, setPreferFast] = useState(false);
    // A carve estimated to be slow, waiting for the visitor to go ahead
    const [slow, setSlow] = useState<{ request: CarveRequest, seconds: number }>();
    // The image the latest carve started from, for the result's name
    const [carvedName, setCarvedName] = useState('');

    const carving = state.status === 'carving';

    // The object URL to revoke as the component unmounts
    const chosenUrl = useRef<string>();
    useEffect(() => () => {
        // A decode still running revokes its URL when it finds itself replaced
        decoding.current = undefined;
        if (chosenUrl.current) URL.revokeObjectURL(chosenUrl.current);
    }, []);

    // Any change to the form drops a slow warning given for the values before it
    useEffect(() => {
        const subscription = watch(() => setSlow(undefined));
        return () => subscription.unsubscribe();
    }, [watch]);

    function showChosen(image: ChosenImage | undefined) {
        if (chosenUrl.current) URL.revokeObjectURL(chosenUrl.current);
        chosenUrl.current = image?.url;
        setChosen(image);
    }

    function onFileChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        showChosen(undefined);
        setSlow(undefined);
        if (!file) {
            decoding.current = undefined;
            return;
        }
        const thisDecode: Promise<ChosenImage | undefined> = chooseImage(file).then(image => {
            if (decoding.current !== thisDecode) {
                // Another file was chosen meanwhile
                if (image) URL.revokeObjectURL(image.url);
                return undefined;
            }
            if (image) {
                showChosen(image);
                // A new image needs new targets: start from its own size
                setValue('width', String(image.width));
                setValue('height', String(image.height));
                clearErrors(['width', 'height']);
            }
            return image;
        });
        decoding.current = thisDecode;
        thisDecode.then(() => {
            if (decoding.current === thisDecode) trigger('file');
        });
    }

    const forced = forcedVariant();
    const javaTakes = (image: Pixels) => image.width * image.height <= JAVA_MAX_PIXELS;

    async function onSubmit(data: FormValues) {
        const image = await decoding.current;
        if (!image) return;
        const targetWidth = parseInt(data.width);
        const targetHeight = parseInt(data.height);
        const engine = forced ? engineOf(forced) : chooseEngine(image.width * image.height, preferFast);
        const request: CarveRequest = {
            engine,
            variant: forced,
            rgb: image.rgb,
            width: image.width,
            height: image.height,
            targetWidth,
            targetHeight,
        };
        const seconds = estimateSeconds(forced ?? (engine === 'java' ? 'java-wasm' : 'rust'),
            image.width, image.height, targetWidth, targetHeight);
        if (seconds > SLOW_SECONDS) {
            setSlow({ request, seconds });
            return;
        }
        start(request, image.name);
    }

    function start(request: CarveRequest, name: string) {
        setSlow(undefined);
        setCarvedName(name);
        carve(request);
    }

    async function validateFile(files: FileList): Promise<ValidateResult> {
        if (!files[0]) return true;
        const image = await decoding.current;
        return image ? true : "Couldn't read this file as an image. Choose a PNG or JPEG.";
    }

    // A target can't exceed the image; without a readable image, the file's own error stops the submit
    async function withinImage(value: string, side: 'width' | 'height'): Promise<ValidateResult> {
        const image = await decoding.current;
        if (!image) return true;
        return parseInt(value) <= image[side] ? true : `Target ${side} must be <= the input image's ${side}, ${image[side]}`;
    }

    const fileRegistration = register('file', {
        validate: { image: validateFile },
        required: { value: true, message: 'An image file is required' },
    });

    const describedBy = (...ids: (string | false | undefined)[]) => ids.filter(Boolean).join(' ') || undefined;

    const tooLargeForJava = !!chosen && !javaTakes(chosen);
    const percent = carving && state.total > 0 ? Math.round(100 * state.done / state.total) : 0;

    return (
        <Container>
            <Form noValidate onSubmit={handleSubmit(onSubmit)}>
                <Form.Group>
                    <Form.Label htmlFor="seamCarverFile">Image File</Form.Label>
                    <Form.Control
                        type="file"
                        id="seamCarverFile"
                        accept="image/*"
                        disabled={carving}
                        isInvalid={!!errors.file}
                        aria-invalid={!!errors.file}
                        aria-describedby={describedBy('seamCarverFileHelp', errors.file && 'seamCarverFileError')}
                        {...fileRegistration}
                        onChange={async event => {
                            // First, so RHF's revalidation awaits this file's decode, not the previous one's
                            onFileChange(event as ChangeEvent<HTMLInputElement>);
                            await fileRegistration.onChange(event);
                        }}
                    />
                    <Form.Text id="seamCarverFileHelp" muted>
                        {chosen && <>Chosen image: {formatSize(chosen.width, chosen.height)}. </>}
                        {text(SiteText.SeamCarverDecodeNote)}
                    </Form.Text>
                    {errors.file &&
                        <Form.Control.Feedback type="invalid" id="seamCarverFileError">
                            {errors.file.message}
                        </Form.Control.Feedback>
                    }
                </Form.Group>
                <Form.Row>
                    {(['width', 'height'] as const).map(side => {
                        const id = `seamCarverTarget-${side}`;
                        const label = side === 'width' ? 'Target Width' : 'Target Height';
                        return (
                            <Form.Group as={Col} xs={12} sm={6} key={side}>
                                <Form.Label htmlFor={id}>{label}</Form.Label>
                                <Form.Control
                                    type="number"
                                    id={id}
                                    min={1}
                                    disabled={carving}
                                    isInvalid={!!errors[side]}
                                    aria-invalid={!!errors[side]}
                                    aria-describedby={describedBy(errors[side] && `${id}-error`)}
                                    {...register(side, {
                                        validate: {
                                            positive: v => parseInt(v) > 0 ? true : `Target ${side} must be positive`,
                                            withinImage: v => withinImage(v, side),
                                        },
                                        required: { value: true, message: `A target ${side} is required` },
                                    })}
                                />
                                {errors[side] &&
                                    <Form.Control.Feedback type="invalid" id={`${id}-error`}>
                                        {errors[side]?.message}
                                    </Form.Control.Feedback>
                                }
                            </Form.Group>
                        );
                    })}
                </Form.Row>
                <Form.Group>
                    <Form.Check
                        type="switch"
                        id="seamCarverFastEngine"
                        label={text(SiteText.SeamCarverUseFastEngine)}
                        checked={preferFast || tooLargeForJava}
                        disabled={carving || tooLargeForJava}
                        aria-describedby={tooLargeForJava ? 'seamCarverFastEngineHelp' : undefined}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => {
                            setPreferFast(event.target.checked);
                            setSlow(undefined);
                        }}
                    />
                    {tooLargeForJava &&
                        <Form.Text id="seamCarverFastEngineHelp" muted>
                            {text(SiteText.SeamCarverJavaTooLarge, { pixels: JAVA_MAX_PIXELS.toLocaleString('en-US') })}
                        </Form.Text>
                    }
                </Form.Group>
                {slow &&
                    <Alert variant="warning" className="d-flex align-items-center flex-wrap">
                        <span className="mr-3">{text(SiteText.SeamCarverSlowWarning, { time: formatDuration(slow.seconds) })}</span>
                        <Button variant="warning" onClick={() => chosen && start(slow.request, chosen.name)}>
                            {text(SiteText.SeamCarverCarveAnyway)}
                        </Button>
                    </Alert>
                }
                <Button type="submit" disabled={carving}>Carve</Button>
                {carving && <Button variant="secondary" className="ml-2" onClick={cancel}>Cancel</Button>}
            </Form>
            <Row className="mt-3">
                <Col xs={12} md={6}>
                    {chosen &&
                        <Img
                            src={chosen.url}
                            alt={`Input image, ${formatSize(chosen.width, chosen.height)}`}
                            fluid
                        />
                    }
                </Col>
                <Col xs={12} md={6}>
                    {/* Always mounted, so screen readers announce what appears in it */}
                    <div role="status">
                        {carving &&
                            <span>
                                Carving with {state.engine === 'java' ? 'the original Java' : 'the Rust engine'}
                                {state.total > 0 && <>: {state.done} of {state.total} seams</>}
                            </span>
                        }
                        {state.status === 'cancelled' && <span>Carve cancelled.</span>}
                    </div>
                    {carving &&
                        // A bar inside a ProgressBar takes the props, so the label names the progressbar itself
                        <ProgressBar className="my-2">
                            <ProgressBar now={percent} aria-label="Carving progress"/>
                        </ProgressBar>
                    }
                    {state.status === 'done' && <CarvedImage result={state.result} name={carvedName}/>}
                    {state.status === 'error' &&
                        <Alert variant="danger">
                            {state.message}
                        </Alert>
                    }
                </Col>
            </Row>
        </Container>
    );
}

export default SeamCarverPage;
