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
