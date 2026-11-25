import { useCallback, useEffect, useRef, useState } from 'react';
import { Pixels } from './engine/decode';
import { FrameMessage, SeamDirection, ViewLayer, ViewMessage, ViewReply } from './engine/protocol';
import { createCarveWorker } from './useSeamCarver';

export type ViewRequest = { layer: ViewLayer, seam?: SeamDirection };

export const viewFailedMessage = (detail: string) => `Couldn't show the seams: ${detail}`;

// Drives the visualisation's own worker (the carve worker's script, on the Rust engine): one image at
// a time, one message in flight, each answered with a frame. The worker starts on the first request
// that needs it (until then the page draws the input itself) and begins the image then.
// restart() drops the view of the image (the worker keeps its engine); restartIfStepped() only does
// if a seam has been asked off it (else the worker's view of the image is still the input's);
// discard() also ends the worker, as a new image, an error and unmounting do, since WebAssembly memory
// never shrinks. Nothing is sent while an earlier session's replies are still coming (busy), so
// abandoned sessions can't queue up full images and energy maps in the worker.
export function useSeamView(makeWorker: () => Worker = createCarveWorker) {
    const [frame, setFrame] = useState<FrameMessage>();
    const [error, setError] = useState<string>();
    const [busy, setBusy] = useState(false);
    const worker = useRef<Worker>();
    // Tags the messages of one view of one image; replies from an earlier one are dropped
    const session = useRef(0);
    // Whether the worker has this session's image
    const begun = useRef(false);
    // Whether this session has asked for a step
    const stepped = useRef(false);
    // The worker's messages not answered yet, of any session (a first step sends the image, then the step)
    const outstanding = useRef(0);

    const restart = useCallback(() => {
        session.current++;
        begun.current = false;
        stepped.current = false;
        setFrame(undefined);
        setError(undefined);
        setBusy(outstanding.current > 0);
    }, []);

    const restartIfStepped = useCallback(() => {
        if (stepped.current) restart();
    }, [restart]);

    const discard = useCallback(() => {
        worker.current?.terminate();
        worker.current = undefined;
        outstanding.current = 0;
        restart();
    }, [restart]);

    useEffect(() => () => {
        worker.current?.terminate();
        worker.current = undefined;
    }, []);

    const fail = useCallback((detail: string) => {
        discard();
        setError(viewFailedMessage(detail));
    }, [discard]);

    // Asks the worker for a frame of the image: after a step in that direction, or as it is
    const request = useCallback((image: Pixels, view: ViewRequest, step?: SeamDirection) => {
        let current = worker.current;
        if (!current) {
            current = makeWorker();
            worker.current = current;
            current.onmessage = (event: MessageEvent<ViewReply>) => {
                const reply = event.data;
                if (worker.current !== current) return;
                outstanding.current--;
                if (reply.session !== session.current) {
                    setBusy(outstanding.current > 0);
                } else if (reply.type === 'view-error') {
                    fail(reply.message);
                } else {
                    setFrame(reply);
                    setBusy(outstanding.current > 0);
                }
            };
            current.onerror = (event: ErrorEvent) => {
                if (worker.current !== current) return;
                event.preventDefault?.();
                fail(event.message || 'the worker stopped');
            };
        }
        const tag = { session: session.current, ...view };
        const send = (message: ViewMessage) => {
            outstanding.current++;
            current!.postMessage(message);
        };
        setError(undefined);
        setBusy(true);
        if (!begun.current) {
            begun.current = true;
            // Before a step, the image's own frame needs no seam: the step's frame shows the next one
            send({ type: 'view-begin', rgb: image.rgb, width: image.width, height: image.height, ...tag,
                seam: step ? undefined : tag.seam });
            if (!step) return;
        }
        if (step) stepped.current = true;
        send(step ? { type: 'view-step', direction: step, ...tag } : { type: 'view-show', ...tag });
    }, [fail, makeWorker]);

    return { frame, error, busy, request, restart, restartIfStepped, discard };
}
