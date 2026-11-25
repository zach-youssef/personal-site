import { Engine, Variant } from './protocol';

// Where the backend serves ./build-seamcarver's output: manifest.json names each engine's files,
// relative to it, by names that carry their content's hash (so a cached file is always right, and
// a deploy can't pair old JavaScript with new WebAssembly). The manifest itself is served no-cache.
export const ENGINE_ASSETS = '/assets/seamcarver-web/';

export interface Manifest {
    java: { wasm: string, wasmRuntime: string, js: string },
    flat: { js: string, wasm: string },
}

// One image being carved a seam at a time: the shape both engines export (the Java's WebCarver,
// the Rust Carver), so one loop drives either
export interface StepCarver {
    width(): number,
    height(): number,
    stepVertical(): void,
    stepHorizontal(): void,
    // Row-major 0x00RRGGBB pixels of width() x height()
    result(): Int32Array,
    // Frees the image
    end(): void,
}

export interface LoadedEngine {
    variant: Variant,
    begin(rgb: Int32Array, width: number, height: number): StepCarver,
}

// What loading needs from its surroundings, so tests can stand in for the network and the modules
export interface LoadDeps {
    // The URL the asset paths resolve against (the worker's location)
    base: string,
    fetch: typeof fetch,
    importModule: (url: string) => Promise<any>,
    // Told why the Java's WebAssembly couldn't load when the JavaScript is used instead
    warn?: (message: string) => void,
}

// A dynamic import of a URL computed at run time, which Vite leaves alone
export const importUrl = (url: string): Promise<any> => import(/* @vite-ignore */ url);

async function readManifest(deps: LoadDeps): Promise<Manifest> {
    const url = new URL(`${ENGINE_ASSETS}manifest.json`, deps.base).href;
    const response = await deps.fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Couldn't load the seam carver's engines (error ${response.status})`);
    return response.json();
}

// TeaVM's WebCarver: static exports, one image at a time
interface JavaExports {
    begin(rgb: Int32Array, width: number, height: number): void,
    width(): number,
    height(): number,
    stepVertical(): void,
    stepHorizontal(): void,
    result(): ArrayLike<number>,
    end(): void,
}

function javaEngine(variant: Variant, exports: JavaExports): LoadedEngine {
    return {
        variant,
        begin(rgb, width, height) {
            exports.begin(rgb, width, height);
            return {
                width: () => exports.width(),
                height: () => exports.height(),
                stepVertical: () => exports.stepVertical(),
                stepHorizontal: () => exports.stepHorizontal(),
                result: () => Int32Array.from(exports.result()),
                end: () => exports.end(),
            };
        },
    };
}

async function loadJavaWasm(manifest: Manifest, deps: LoadDeps, asset: (path: string) => string) {
    const runtime = await deps.importModule(asset(manifest.java.wasmRuntime));
    const teavm = await runtime.load(asset(manifest.java.wasm));
    return javaEngine('java-wasm', teavm.exports);
}

async function loadJavaJs(manifest: Manifest, deps: LoadDeps, asset: (path: string) => string) {
    return javaEngine('java-js', await deps.importModule(asset(manifest.java.js)));
}

async function loadRust(manifest: Manifest, deps: LoadDeps, asset: (path: string) => string): Promise<LoadedEngine> {
    const { default: init, Carver } = await deps.importModule(asset(manifest.flat.js));
    await init({ module_or_path: asset(manifest.flat.wasm) });
    return {
        variant: 'rust',
        begin(rgb, width, height) {
            const carver = new Carver(new Uint32Array(rgb.buffer, rgb.byteOffset, rgb.length), width, height);
            return {
                width: () => carver.width(),
                height: () => carver.height(),
                stepVertical: () => carver.step_vertical(),
                stepHorizontal: () => carver.step_horizontal(),
                result: () => {
                    const rgb: Uint32Array = carver.rgb();
                    return new Int32Array(rgb.buffer, rgb.byteOffset, rgb.length);
                },
                end: () => carver.free(),
            };
        },
    };
}

// Loads an engine. The Java loads as WebAssembly where the browser can compile TeaVM's output
// (WasmGC and exnref: Chrome 137, Firefox 131, Safari 18.4) and as JavaScript elsewhere (decision
// D7). Any failure to load the WebAssembly falls back, since browsers differ in what they throw
// (a CompileError or LinkError, or a TypeError from the runtime on a missing WebAssembly API);
// a variant asked for by name loads as that variant or fails.
export async function loadEngine(engine: Engine, variant: Variant | undefined, deps: LoadDeps): Promise<LoadedEngine> {
    const manifest = await readManifest(deps);
    const asset = (path: string) => new URL(`${ENGINE_ASSETS}${path}`, deps.base).href;
    if (engine === 'rust') return loadRust(manifest, deps, asset);
    if (variant === 'java-js') return loadJavaJs(manifest, deps, asset);
    if (variant === 'java-wasm') return loadJavaWasm(manifest, deps, asset);
    try {
        return await loadJavaWasm(manifest, deps, asset);
    } catch (e) {
        deps.warn?.(`The Java's WebAssembly didn't load, so it runs as JavaScript: ${e}`);
        return loadJavaJs(manifest, deps, asset);
    }
}
