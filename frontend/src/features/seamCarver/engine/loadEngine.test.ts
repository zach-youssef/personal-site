import { describe, expect, it, vi } from 'vitest';
import { loadEngine, Manifest } from './loadEngine';

const BASE = 'https://example.test/assets/carve.worker-abc.js';
const MANIFEST: Manifest = {
    java: { wasm: 'java/carver.1.wasm', wasmRuntime: 'java/carver.wasm-runtime.2.js', js: 'java/carver.3.js' },
    flat: { js: 'flat/flat.4.js', wasm: 'flat/flat_bg.5.wasm' },
};
const at = (path: string) => `https://example.test/assets/seamcarver-web/${path}`;

// A Java module (WebCarver's exports) whose image starts w x h and shrinks a pixel per step
function javaExports() {
    let w = 0, h = 0;
    return {
        begin: vi.fn((_rgb: Int32Array, width: number, height: number) => { w = width; h = height; }),
        width: () => w,
        height: () => h,
        stepVertical: () => { w--; },
        stepHorizontal: () => { h--; },
        result: () => [1, 2],
        end: vi.fn(),
    };
}

function deps(modules: Record<string, () => unknown>, manifestStatus = 200) {
    const fetchMock = vi.fn(async () => ({ ok: manifestStatus === 200, status: manifestStatus, json: async () => MANIFEST }));
    const importModule = vi.fn(async (url: string) => {
        const module = modules[url];
        if (!module) throw new Error(`no module ${url}`);
        return module();
    });
    const warn = vi.fn();
    return { base: BASE, fetch: fetchMock as unknown as typeof fetch, importModule, warn, fetchMock };
}

describe('loadEngine', () => {
    it('reads the manifest afresh from the engine assets', async () => {
        const d = deps({ [at(MANIFEST.java.js)]: javaExports });
        await loadEngine('java', 'java-js', d);
        expect(d.fetchMock).toHaveBeenCalledWith(at('manifest.json'), { cache: 'no-cache' });
    });

    it("loads the Java's WebAssembly through its runtime", async () => {
        const exports = javaExports();
        const load = vi.fn(async () => ({ exports }));
        const d = deps({ [at(MANIFEST.java.wasmRuntime)]: () => ({ load }) });

        const engine = await loadEngine('java', undefined, d);

        expect(engine.variant).toBe('java-wasm');
        expect(load).toHaveBeenCalledWith(at(MANIFEST.java.wasm));
        const carver = engine.begin(new Int32Array(6), 3, 2);
        expect(exports.begin).toHaveBeenCalledWith(new Int32Array(6), 3, 2);
        carver.stepVertical();
        expect([carver.width(), carver.height()]).toEqual([2, 2]);
        expect(carver.result()).toEqual(Int32Array.from([1, 2]));
        carver.end();
        expect(exports.end).toHaveBeenCalled();
    });

    it("falls back to the Java's JavaScript when the WebAssembly doesn't compile", async () => {
        const load = vi.fn(async () => { throw new WebAssembly.CompileError('unknown type'); });
        const d = deps({
            [at(MANIFEST.java.wasmRuntime)]: () => ({ load }),
            [at(MANIFEST.java.js)]: javaExports,
        });

        const engine = await loadEngine('java', undefined, d);

        expect(engine.variant).toBe('java-js');
        expect(d.warn).toHaveBeenCalledWith(expect.stringContaining('unknown type'));
    });

    it('loads a variant asked for by name without falling back', async () => {
        const load = vi.fn(async () => { throw new WebAssembly.CompileError('unknown type'); });
        const d = deps({
            [at(MANIFEST.java.wasmRuntime)]: () => ({ load }),
            [at(MANIFEST.java.js)]: javaExports,
        });

        await expect(loadEngine('java', 'java-wasm', d)).rejects.toThrow('unknown type');
        expect((await loadEngine('java', 'java-js', d)).variant).toBe('java-js');
        expect(d.importModule).not.toHaveBeenCalledWith(at(MANIFEST.flat.js));
    });

    it("initialises the Rust engine with its module's URL", async () => {
        const init = vi.fn(async () => undefined);
        const instances: { rgb: Uint32Array, w: number, h: number }[] = [];
        class Carver {
            constructor(rgb: Uint32Array, public w: number, public h: number) {
                instances.push({ rgb, w, h });
            }
            width() { return this.w; }
            height() { return this.h; }
            step_vertical() { this.w--; }
            step_horizontal() { this.h--; }
            rgb() { return Uint32Array.from([0xffffff, 1]); }
            energy_map() { return Uint8Array.from([255, 0]); }
            next_vertical_seam() { return Uint32Array.from([1]); }
            next_horizontal_seam() { return Uint32Array.from([0, 0]); }
            free = vi.fn();
        }
        const d = deps({ [at(MANIFEST.flat.js)]: () => ({ default: init, Carver }) });

        const engine = await loadEngine('rust', undefined, d);

        expect(engine.variant).toBe('rust');
        expect(init).toHaveBeenCalledWith({ module_or_path: at(MANIFEST.flat.wasm) });
        const carver = engine.begin(Int32Array.from([0x123456, 2]), 2, 1);
        expect(Array.from(instances[0].rgb)).toEqual([0x123456, 2]);
        carver.stepHorizontal();
        expect(carver.height()).toBe(0);
        expect(Array.from(carver.result())).toEqual([0xffffff, 1]);
        // What the visualisation reads
        expect(Array.from(carver.energyMap())).toEqual([255, 0]);
        expect(Array.from(carver.nextVerticalSeam())).toEqual([1]);
        expect(Array.from(carver.nextHorizontalSeam())).toEqual([0, 0]);
    });

    it('fails when the manifest is missing', async () => {
        await expect(loadEngine('rust', undefined, deps({}, 404))).rejects.toThrow('error 404');
    });
});
