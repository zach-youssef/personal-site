// The messages between the seam carver page and its worker (carve.worker.ts). One worker carves one
// image at a time; the page stops a carve by terminating the worker (the only way to stop the
// Java's blocking loop) and starts a fresh one for the next.

// The two engines: the original SeamCarving Java (built by TeaVM) and the Rust flat-array engine
export type Engine = 'java' | 'rust';

// How an engine ran: the Java as TeaVM's WebAssembly (needs WasmGC and exnref) or, in browsers
// without those, as TeaVM's JavaScript; the Rust engine is plain WebAssembly
export type Variant = 'java-wasm' | 'java-js' | 'rust';

export const VARIANTS: readonly Variant[] = ['java-wasm', 'java-js', 'rust'];

export const engineOf = (variant: Variant): Engine => variant === 'rust' ? 'rust' : 'java';

// Pixels are row-major 0x00RRGGBB, rows top to bottom (the goldens' format)
export type StartMessage = {
    type: 'start',
    engine: Engine,
    // Forces one variant (the e2e's ?engine= hook); otherwise the Java tries WebAssembly first
    variant?: Variant,
    rgb: Int32Array,
    width: number,
    height: number,
    targetWidth: number,
    targetHeight: number,
};

// Seams removed so far of the carve's total
export type ProgressMessage = { type: 'progress', done: number, total: number };

export type DoneMessage = {
    type: 'done',
    rgb: Int32Array,
    // The result as a PNG for the download, encoded here rather than on the page's thread
    png: Uint8Array,
    width: number,
    height: number,
    variant: Variant,
    // Loading the engine and carving
    ms: number,
};

// 'out-of-memory': the engine ran out of memory (for the Java, the page reruns on Rust);
// 'failed': anything else, with the engine's message
export type ErrorMessage = { type: 'error', reason: 'out-of-memory' | 'failed', engine: Engine, message: string };

export type WorkerMessage = ProgressMessage | DoneMessage | ErrorMessage;

// The visualisation (SeamCarverView) runs on a worker of its own, on the Rust engine for every
// image (its energy map and seams are the Java's, by the goldens). It sends one message at a time
// and waits for the frame each one answers with. `session` tags a view of one image: a reply to an
// older session is stale and dropped.

// What a frame shows: the image or its energy map ...
export type ViewLayer = 'image' | 'energy';
// ... and the seam to overlay, the one the next step would remove (none when hidden or at the target)
export type SeamDirection = 'vertical' | 'horizontal';
export type FrameRequest = { session: number, layer: ViewLayer, seam?: SeamDirection };

// Starts a view of the image as it is (dropping the worker's previous one)
export type ViewBeginMessage = { type: 'view-begin', rgb: Int32Array, width: number, height: number } & FrameRequest;
// Removes the next seam in that direction
export type ViewStepMessage = { type: 'view-step', direction: SeamDirection } & FrameRequest;
// Redraws the view as it is, with another layer or seam
export type ViewShowMessage = { type: 'view-show' } & FrameRequest;

export type ViewMessage = ViewBeginMessage | ViewStepMessage | ViewShowMessage;

export type FrameMessage = {
    type: 'frame',
    session: number,
    width: number,
    height: number,
    layer: ViewLayer,
    // Row-major 0x00RRGGBB of width x height: the image, or the energy map grey in every channel
    pixels: Int32Array,
    // Seams removed since the view began
    removed: number,
    // The next seam in the direction asked for: a column per row (vertical) or a row per column
    seam?: { direction: SeamDirection, positions: Uint32Array },
};

// The view failed (the page drops the worker and starts again from the input)
export type ViewErrorMessage = { type: 'view-error', session: number, message: string };

export type ViewReply = FrameMessage | ViewErrorMessage;
