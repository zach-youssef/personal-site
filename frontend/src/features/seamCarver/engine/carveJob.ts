import { Pixels } from './decode';
import { LoadedEngine } from './loadEngine';
import { Engine, StartMessage, Variant, WorkerMessage } from './protocol';

// Progress goes out at most this often (plus once at the start and once at the end), so a fast
// engine doesn't flood the page with messages
export const PROGRESS_INTERVAL_MS = 50;

export interface JobDeps {
    load(engine: Engine, variant: Variant | undefined): Promise<LoadedEngine>,
    // transfer: buffers to hand over rather than copy
    post(message: WorkerMessage, transfer?: Transferable[]): void,
    now(): number,
    // The result as a PNG (decode.ts's encodePng)
    encode(pixels: Pixels): Uint8Array,
}

// Whether an error is the engine running out of memory. The Java's object graph (~3.4 KB a pixel)
// can exhaust the heap: TeaVM's WebAssembly then traps (a WebAssembly.RuntimeError) or the browser
// refuses an allocation (a RangeError), and its JavaScript throws the same RangeError or Java's
// OutOfMemoryError. The Rust engine reports a failed reservation as an Error "OutOfMemory..."; a
// later allocation failure traps (its panics abort), and so would a bug, which this can't tell apart.
// Since a trap can also be a bug, the page logs the engine's own message whenever it reports one as
// running out of memory.
export function isOutOfMemory(error: unknown): boolean {
    if (error instanceof RangeError) return true;
    if (typeof WebAssembly !== 'undefined' && error instanceof WebAssembly.RuntimeError) return true;
    return OUT_OF_MEMORY.test(errorMessage(error));
}

// How engines and browsers word running out of memory ("out of memory", OutOfMemoryError, ...)
export const OUT_OF_MEMORY = /out ?of ?memory/i;

// An error's message, without the "Error: " that String() would put first
export function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    const message = (error as { message?: unknown })?.message;
    return typeof message === 'string' ? message : String(error);
}

// Carves the image the start message carries, all vertical seams first, then all horizontal ones
// (as SeamCarver.carve does), and posts progress, then the result or the error
export async function runCarve(message: StartMessage, deps: JobDeps): Promise<void> {
    const start = deps.now();
    const { width, height, targetWidth, targetHeight } = message;
    const total = (width - targetWidth) + (height - targetHeight);
    let engine: LoadedEngine;
    try {
        engine = await deps.load(message.engine, message.variant);
    } catch (e) {
        deps.post({ type: 'error', reason: 'failed', engine: message.engine, message: errorMessage(e) });
        return;
    }
    try {
        if (targetWidth < 1 || targetHeight < 1 || targetWidth > width || targetHeight > height) {
            throw new Error(`Can't carve ${width}x${height} to ${targetWidth}x${targetHeight}`);
        }
        const carver = engine.begin(message.rgb, width, height);
        try {
            let done = 0;
            let lastPost = deps.now();
            deps.post({ type: 'progress', done, total });
            const step = () => {
                done++;
                const now = deps.now();
                if (now - lastPost >= PROGRESS_INTERVAL_MS) {
                    lastPost = now;
                    deps.post({ type: 'progress', done, total });
                }
            };
            while (carver.width() > targetWidth) {
                carver.stepVertical();
                step();
            }
            while (carver.height() > targetHeight) {
                carver.stepHorizontal();
                step();
            }
            deps.post({ type: 'progress', done, total });
            const rgb = carver.result();
            const ms = deps.now() - start;
            const result = { rgb, width: carver.width(), height: carver.height() };
            const png = deps.encode(result);
            deps.post({ type: 'done', ...result, png, variant: engine.variant, ms }, [rgb.buffer, png.buffer]);
        } finally {
            // After a trap the engine may refuse this too; the page discards the worker anyway,
            // and the error to report is the first one
            try {
                carver.end();
            } catch {
                // ignored
            }
        }
    } catch (e) {
        deps.post({
            type: 'error',
            reason: isOutOfMemory(e) ? 'out-of-memory' : 'failed',
            engine: message.engine,
            message: errorMessage(e),
        });
    }
}
