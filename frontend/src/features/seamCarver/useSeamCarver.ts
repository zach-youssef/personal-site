import { useCallback, useEffect, useRef, useState } from 'react';
import { OUT_OF_MEMORY } from './engine/carveJob';
import { JAVA_MAX_PIXELS } from './engine/estimate';
import { Engine, StartMessage, Variant, WorkerMessage } from './engine/protocol';

export type CarveRequest = Omit<StartMessage, 'type'>;

export type CarveResult = {
    rgb: Int32Array,
    // The result as a PNG, for the download
    png: Uint8Array,
    width: number,
    height: number,
    variant: Variant,
    ms: number,
    // The Java ran out of memory, so the Rust engine carved the image instead
    reranAfterOutOfMemory: boolean,
};

export type CarveState =
    | { status: 'idle' }
    | { status: 'carving', engine: Engine, done: number, total: number }
    | { status: 'done', result: CarveResult }
    | { status: 'error', message: string }
    | { status: 'cancelled' };

// The worker, made where Vite can see it (it bundles the worker's module from this expression)
export function createCarveWorker(): Worker {
    return new Worker(new URL('./engine/carve.worker.ts', import.meta.url), { type: 'module' });
}

// What the visitor sees when a carve fails
export const OUT_OF_MEMORY_MESSAGE = "This browser ran out of memory carving the image. Try a smaller one.";
export const failedMessage = (detail: string) => `Couldn't carve the image: ${detail}`;

// Runs carves on the seam carver's worker (engine/carve.worker.ts) and tracks the latest one.
// A worker carves one image at a time and is kept for the next carve, which reuses the engines it
// loaded, unless the image was larger than the Java takes: WebAssembly memory never shrinks, so a
// worker that carved a large image would hold hundreds of MB, under the next (Java) carve too.
// Cancelling terminates it (nothing else stops the Java's loop), as do an error and unmounting;
// the next carve starts a fresh one. A Java carve that runs out of memory reruns on the Rust
// engine.
export function useSeamCarver(makeWorker: () => Worker = createCarveWorker) {
    const [state, setState] = useState<CarveState>({ status: 'idle' });
    const worker = useRef<Worker>();

    const discard = useCallback(() => {
        worker.current?.terminate();
        worker.current = undefined;
    }, []);

    useEffect(() => discard, [discard]);

    const run = useCallback((request: CarveRequest, reranAfterOutOfMemory: boolean) => {
        const current = worker.current ?? makeWorker();
        worker.current = current;
        // Messages from a worker this hook has since replaced are ignored
        const mine = () => worker.current === current;
        // A worker whose engine failed may be left in a broken state (a trapped WebAssembly
        // instance refuses every later call), so it is never reused
        const fail = (outOfMemory: boolean, detail: string) => {
            discard();
            if (outOfMemory) {
                // A trap counts as running out of memory, but may be a bug: keep its message
                console.warn(`The seam carver's ${request.engine} engine ran out of memory: ${detail}`);
            }
            if (outOfMemory && request.engine === 'java') {
                run({ ...request, engine: 'rust', variant: undefined }, true);
            } else if (outOfMemory) {
                setState({ status: 'error', message: OUT_OF_MEMORY_MESSAGE });
            } else {
                setState({ status: 'error', message: failedMessage(detail) });
            }
        };
        current.onmessage = (event: MessageEvent<WorkerMessage>) => {
            if (!mine()) return;
            const message = event.data;
            switch (message.type) {
                case 'progress':
                    setState({ status: 'carving', engine: request.engine, done: message.done, total: message.total });
                    break;
                case 'done':
                    if (request.width * request.height > JAVA_MAX_PIXELS) discard();
                    setState({
                        status: 'done',
                        result: {
                            rgb: message.rgb,
                            png: message.png,
                            width: message.width,
                            height: message.height,
                            variant: message.variant,
                            ms: message.ms,
                            reranAfterOutOfMemory,
                        },
                    });
                    break;
                case 'error':
                    fail(message.reason === 'out-of-memory', message.message);
                    break;
            }
        };
        // The worker's script failed to load, or it died: of an exception it didn't catch, or of
        // running out of memory where the engine can't catch that (SpiderMonkey ends the worker's
        // script with "out of memory")
        current.onerror = (event: ErrorEvent) => {
            if (!mine()) return;
            event.preventDefault?.();
            const detail = event.message || 'the worker stopped';
            fail(OUT_OF_MEMORY.test(detail), detail);
        };
        setState({ status: 'carving', engine: request.engine, done: 0, total: 0 });
        const message: StartMessage = { type: 'start', ...request };
        current.postMessage(message);
    }, [discard, makeWorker]);

    const carve = useCallback((request: CarveRequest) => run(request, false), [run]);

    const cancel = useCallback(() => {
        discard();
        setState({ status: 'cancelled' });
    }, [discard]);

    return { state, carve, cancel };
}
