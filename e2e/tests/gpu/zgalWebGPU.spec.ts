import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { collectErrors, colorCount } from '../pageChecks';
import { decodePng, Pixels } from '../png';
import { WEBGPU_LAUNCH_OPTIONS } from './webgpu';

test.use({ launchOptions: WEBGPU_LAUNCH_OPTIONS });

// Each example the page offers, at the URL that selects it; particles is the default
const SAMPLES = [
    { title: 'Particles', path: '/projects/zgal' },
    { title: 'Scene', path: '/projects/zgal?sample=scene' },
];

for (const { title, path } of SAMPLES) {
    test(`runs the ${title.toLowerCase()} example in the page`, async ({ page }) => {
        // Scene's shadow map, PBR and tonemap passes are slow on SwiftShader
        test.setTimeout(90_000);
        const errors = collectErrors(page);
        await page.goto(path);

        const frame = page.locator(`iframe[title="${title}"]`);
        const program = frame.contentFrame();
        await expect(program.locator('html')).toHaveAttribute('data-zgal', 'running', { timeout: 30_000 });
        // A drawn canvas, rather than a cleared one, after drawing frames without errors, which the
        // runner would show over it
        await expect.poll(() => colorCount(page, program.locator('canvas')), { timeout: 30_000 }).toBeGreaterThan(100);
        await expect(program.locator('#zgal-message')).toHaveCount(0);
        await expect(program.locator('html')).toHaveAttribute('data-zgal', 'running');
        // Scaled to the frame rather than cropped by it, and smoothly rather than pixelated
        const frameBox = (await frame.boundingBox())!;
        const canvasBox = (await program.locator('canvas').boundingBox())!;
        expect(canvasBox.x).toBeCloseTo(frameBox.x, 0);
        expect(canvasBox.y).toBeCloseTo(frameBox.y, 0);
        expect(canvasBox.width).toBeCloseTo(frameBox.width, 0);
        expect(canvasBox.height).toBeCloseTo(frameBox.height, 0);
        await expect(program.locator('canvas')).toHaveCSS('image-rendering', 'auto');
        await expect(page.getByRole('alert')).toHaveCount(0);
        expect(errors).toEqual([]);
    });
}

// image_filter's output that ./build-zgal filtered under Node with --blur 2 --edges, losslessly
const BLUR_EDGES = resolve(__dirname, '../../../graphql-server/assets/zgal/image_filter/blur_edges.png');
const MAIN = '/assets/zgal/image_filter/image_filter.zgal.main.js';

// The PNG the page offers to download, decoded
async function capture(page: Page): Promise<Pixels> {
    const href = await page.getByRole('link', { name: 'Download' }).getAttribute('href');
    const bytes = await page.evaluate(async url => [...new Uint8Array(await (await fetch(url)).arrayBuffer())], href!);
    return decodePng(Buffer.from(bytes));
}

// The most two images' channels differ by
function maxDifference(a: Pixels, b: Pixels): number {
    expect([a.width, a.height]).toEqual([b.width, b.height]);
    let most = 0;
    for (let i = 0; i < a.rgba.length; i++) {
        most = Math.max(most, Math.abs(a.rgba[i] - b.rgba[i]));
    }
    return most;
}

test.describe('the image filter', () => {
    // Each run creates its own WebGPU device on SwiftShader
    test.setTimeout(90_000);

    test('filters the example picture with --blur 2 --edges as the build did, and filters again when a control changes', async ({ page }) => {
        const errors = collectErrors(page);
        await page.goto('/projects/zgal?sample=image_filter');
        const demo = page.locator('.image-filter');

        // As under Node (to 2 per channel, as ZGAL's own page test allows across GPUs)
        await expect(demo).toHaveAttribute('data-zgal', 'stopped', { timeout: 60_000 });
        await expect(page.getByRole('link', { name: 'Download' })).toHaveAttribute('download', 'image_filter.png');
        const reference = decodePng(readFileSync(BLUR_EDGES));
        const first = await capture(page);
        expect(maxDifference(first, reference)).toBeLessThanOrEqual(2);
        await expect(page.getByAltText('Image filter input')).toHaveAttribute('src', '/assets/zgal/image_filter/assets/input.png');

        // The link is gone while a run makes the next output, and getAttribute waits for it
        const download = page.getByRole('link', { name: 'Download' });

        // A switch runs it again at once: the blurred picture without edges
        const firstHref = await download.getAttribute('href');
        await page.getByText('Edges', { exact: true }).click();
        await expect.poll(() => download.getAttribute('href'), { timeout: 60_000 }).not.toBe(firstHref);
        await expect(demo).toHaveAttribute('data-zgal', 'stopped', { timeout: 60_000 });
        const blurred = await capture(page);
        expect(maxDifference(blurred, reference)).toBeGreaterThan(16);

        // A slider, moved by keys, runs it again once it has stopped moving
        const blurredHref = await download.getAttribute('href');
        const radius = page.getByLabel('Blur radius');
        await radius.focus();
        for (let i = 0; i < 6; i++) {
            await radius.press('ArrowRight');
        }
        await expect(page.getByText('8 px')).toBeVisible();
        await expect.poll(() => download.getAttribute('href'), { timeout: 60_000 }).not.toBe(blurredHref);
        await expect(demo).toHaveAttribute('data-zgal', 'stopped', { timeout: 60_000 });
        expect(maxDifference(await capture(page), blurred)).toBeGreaterThan(0);

        await expect(page.getByRole('alert')).toHaveCount(0);
        expect(errors).toEqual([]);
    });

    test('thresholds the example\'s edges into white lines at its default level', async ({ page }) => {
        await page.goto('/projects/zgal?sample=image_filter');
        const demo = page.locator('.image-filter');
        await expect(demo).toHaveAttribute('data-zgal', 'stopped', { timeout: 60_000 });
        const download = page.getByRole('link', { name: 'Download' });
        const edgesHref = await download.getAttribute('href');

        await page.getByText('Threshold', { exact: true }).click();
        await expect(page.getByText('0.15', { exact: true })).toBeVisible();
        await expect.poll(() => download.getAttribute('href'), { timeout: 60_000 }).not.toBe(edgesHref);
        await expect(demo).toHaveAttribute('data-zgal', 'stopped');

        // Black and white, white where the build's edges are at least as bright as the level: a
        // minority of the picture, neither all black nor all white
        const thresholded = await capture(page);
        const reference = decodePng(readFileSync(BLUR_EDGES));
        let white = 0;
        let expected = 0;
        for (let i = 0; i < thresholded.rgba.length; i += 4) {
            expect([0, 255]).toContain(thresholded.rgba[i]);
            white += thresholded.rgba[i] === 255 ? 1 : 0;
            expected += reference.rgba[i] >= 0.15 * 255 ? 1 : 0;
        }
        const pixels = thresholded.width * thresholded.height;
        expect(white / pixels).toBeGreaterThan(0.05);
        expect(white / pixels).toBeLessThan(0.15);
        expect(Math.abs(white - expected) / pixels).toBeLessThan(0.01);
    });

    test('offers exactly the options the program has, in its ranges', async ({ page }) => {
        await page.goto('/projects/zgal?sample=image_filter');
        await expect(page.locator('.image-filter')).toHaveAttribute('data-zgal', 'stopped', { timeout: 60_000 });

        // The program's own list, from its main
        const options = await page.evaluate(async main => {
            const { program } = await import(/* @vite-ignore */ main);
            return (program.options as { kind: string, name: string, range: [number, number] | null }[])
                .filter(option => option.kind !== 'positional')
                .map(({ name, range }) => ({ name, range }));
        }, MAIN);
        const offered = await page.locator('[data-option]').evaluateAll(groups => groups.map(group => {
            const slider = group.querySelector('input[type=range]') as HTMLInputElement | null;
            return {
                name: group.getAttribute('data-option'),
                range: slider ? [Number(slider.min), Number(slider.max)] : null,
            };
        }));
        expect(offered).toEqual(options);
        // Its two positionals: the picture (the file picker) and the PNG it writes (the download)
        await expect(page.getByLabel('Picture')).toHaveAttribute('type', 'file');
        // Offering only what the runtime's decoder (stb_image) reads
        await expect(page.getByLabel('Picture')).toHaveAttribute('accept', '.png,.jpg,.jpeg,.bmp,.gif,.tga,.psd,.pic,.pnm,.pgm,.ppm');
    });

    test('filters a picture the visitor chooses', async ({ page }) => {
        await page.goto('/projects/zgal?sample=image_filter');
        const demo = page.locator('.image-filter');
        await expect(demo).toHaveAttribute('data-zgal', 'stopped', { timeout: 60_000 });

        // The example picture, under another name: the same output
        const exampleHref = await page.getByRole('link', { name: 'Download' }).getAttribute('href');
        await page.getByLabel('Picture').setInputFiles({
            name: 'photo.png',
            mimeType: 'image/png',
            buffer: readFileSync(resolve(__dirname, '../../../graphql-server/assets/zgal/image_filter/assets/input.png')),
        });
        await expect(page.getByAltText('Image filter input')).toHaveAttribute('src', /^blob:/);
        await expect.poll(() => page.getByRole('link', { name: 'Download' }).getAttribute('href'), { timeout: 60_000 }).not.toBe(exampleHref);
        await expect(demo).toHaveAttribute('data-zgal', 'stopped');
        expect(maxDifference(await capture(page), decodePng(readFileSync(BLUR_EDGES)))).toBeLessThanOrEqual(2);

        // Something that isn't a picture fails with the program's reason
        await page.getByLabel('Picture').setInputFiles({ name: 'notes.png', mimeType: 'image/png', buffer: Buffer.from('not a picture') });
        await expect(page.getByRole('alert')).toContainText("Image filter couldn't filter notes.png", { timeout: 60_000 });
        await expect(page.getByAltText('Image filter output')).toHaveCount(0);
    });
});
