import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Page } from '@playwright/test';
import { test, expect } from './fixtures';

// The seam carver's engines for the browser, as ./build-seamcarver puts them in the backend's assets
// (see its header for the files and manifest.json): each must carve a golden in a real browser
// exactly as the original Java did on the JVM. The page's worker isn't involved: a bare page loads
// the modules from the served assets and drives the stepwise exports as the worker does.

const GOLDENS = resolve(__dirname, '../../testdata/seamcarver');
const ASSETS = '/assets/seamcarver-web';

// A .in or .out golden: little-endian int32 width and height, then 0x00RRGGBB int32 pixels
function readGolden(name: string) {
    const bytes = readFileSync(resolve(GOLDENS, name));
    const width = bytes.readInt32LE(0);
    const height = bytes.readInt32LE(4);
    expect(bytes.length).toBe(8 + 4 * width * height);
    const rgb: number[] = [];
    for (let i = 0; i < width * height; i++) rgb.push(bytes.readInt32LE(8 + 4 * i));
    return { width, height, rgb };
}
type Image = ReturnType<typeof readGolden>;

interface Manifest {
    java: { wasm: string, wasmRuntime: string, js: string },
}

// The URL the page loads a manifest entry by: its path under the assets (the file's name carries
// its content's hash, see build-seamcarver)
const url = (path: string) => `${ASSETS}/${path}`;

// Which build of the Java to load: TeaVM's WebAssembly, through its runtime's load(), or its
// JavaScript module, whose named exports are WebCarver's
type Variant = { wasm: { runtime: string, module: string } } | { js: string };

// Carves the input to the target in the page with the given build, as the worker does: all vertical
// seams, then all horizontal ones, through WebCarver's stepwise exports
function carveInBrowser(page: Page, variant: Variant, input: Image, target: { width: number, height: number }) {
    return page.evaluate(async ([variant, input, target]) => {
        // A dynamic import by its own name, so no transpiler turns it into a require
        const load = new Function('url', 'return import(url)') as (url: string) => Promise<any>;
        const carver = 'wasm' in variant
            ? (await (await load(variant.wasm.runtime)).load(variant.wasm.module)).exports
            : await load(variant.js);
        carver.begin(Int32Array.from(input.rgb), input.width, input.height);
        try {
            while (carver.width() > target.width) carver.stepVertical();
            while (carver.height() > target.height) carver.stepHorizontal();
            return Array.from(carver.result() as ArrayLike<number>);
        } finally {
            carver.end();
        }
    }, [variant, input, target] as const);
}

const input = readGolden('medium.in');
const expected = readGolden('medium.out');

test.describe('seam carver engines in the browser', () => {
    let manifest: Manifest;

    test.beforeEach(async ({ page }) => {
        // A bare page on the site's origin, so the modules load relative to it as the worker's do.
        // The manifest names the current build's files, so it must not be cached (the files, named
        // by their hashes, may be).
        const response = await page.goto(`${ASSETS}/manifest.json`);
        expect(response?.headers()['cache-control']).toBe('no-cache');
        manifest = JSON.parse(await page.locator('body').innerText());
        for (const path of Object.values(manifest.java)) {
            expect(path, `${path} named by its hash`).toMatch(/\.[0-9a-f]{16}\.[^./]+$/);
        }
    });

    test('the Java as WebAssembly (TeaVM) carves the medium golden exactly', { tag: '@firefox' }, async ({ page }) => {
        const actual = await carveInBrowser(page, {
            wasm: { runtime: url(manifest.java.wasmRuntime), module: url(manifest.java.wasm) },
        }, input, expected);
        expect(actual.length).toBe(expected.rgb.length);
        expect(actual).toEqual(expected.rgb);
    });

    test('the Java as JavaScript (TeaVM) carves the medium golden exactly', { tag: '@firefox' }, async ({ page }) => {
        const actual = await carveInBrowser(page, { js: url(manifest.java.js) }, input, expected);
        expect(actual.length).toBe(expected.rgb.length);
        expect(actual).toEqual(expected.rgb);
    });
});
