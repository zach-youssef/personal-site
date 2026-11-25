import { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { decodePng, gradientPng } from './png';
import { readGolden } from './seamCarverGoldens';

// The seam carver page carves in the browser, on a worker: the original Java (TeaVM's WebAssembly,
// or its JavaScript where WasmGC is missing) for small images, the Rust engine for large ones or
// when asked. Every carve must match the Java's golden and never reach the server.

// The e2e-gradient golden is gradientPng(60, 40) carved to 45 x 32 by the Java on the JVM
const expected = readGolden('e2e-gradient.out');

const chooseGradient = (page: Page, width = 60, height = 40) =>
    page.getByLabel('Image File').setInputFiles({
        name: 'gradient.png',
        mimeType: 'image/png',
        buffer: gradientPng(width, height),
    });

// Counts requests to the old upload endpoint, from the page or its worker
function countUploads(page: Page) {
    const uploads = { count: 0 };
    page.context().on('request', request => {
        if (new URL(request.url()).pathname.startsWith('/seamCarver')) uploads.count++;
    });
    return uploads;
}

// The carved image's 0x00RRGGBB pixels, read back from its canvas
const canvasPixels = (page: Page, name: string) =>
    page.getByRole('img', { name }).evaluate((canvas: HTMLCanvasElement) => {
        const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
        const rgb: number[] = [];
        for (let i = 0; i < data.length; i += 4) rgb.push((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
        return rgb;
    });

async function carveGradient(page: Page) {
    await chooseGradient(page);
    await expect(page.getByAltText('Input image, 60 × 40 px')).toBeVisible();
    await page.getByLabel('Target Width').fill('45');
    await page.getByLabel('Target Height').fill('32');
    await page.getByRole('button', { name: 'Carve' }).click();
    await expect(page.getByRole('img', { name: 'Carved image, 45 × 32 px' })).toBeVisible({ timeout: 30_000 });
}

const LABELS = {
    'java-wasm': 'Carved by the original Java (WebAssembly via TeaVM)',
    'java-js': 'Carved by the original Java (JavaScript fallback via TeaVM)',
    'rust': 'Carved by the Rust engine (WebAssembly), checked pixel-identical to the Java',
} as const;

test('carves an image in the browser with the original Java by default', { tag: '@firefox' }, async ({ page }) => {
    const uploads = countUploads(page);
    await page.goto('/projects/seamCarver');

    await chooseGradient(page);
    await expect(page.getByText('Chosen image: 60 × 40 px.')).toBeVisible();
    // The targets start at the image's own size
    await expect(page.getByLabel('Target Width')).toHaveValue('60');
    await expect(page.getByLabel('Target Height')).toHaveValue('40');
    await expect(page.getByLabel('Use the fast engine')).not.toBeChecked();
    await carveGradient(page);

    // Both browsers the tests run have WasmGC and exnref
    await expect(page.getByText(LABELS['java-wasm'])).toBeVisible();
    expect(await canvasPixels(page, 'Carved image, 45 × 32 px')).toEqual(expected.rgb);
    const download = page.getByRole('link', { name: 'Download PNG' });
    await expect(download).toHaveAttribute('download', 'gradient-45x32.png');
    await expect(download).toHaveAttribute('href', /^blob:/);
    // The PNG is encoded from the carved pixels (not read back from the canvas): exactly the golden
    const png = await download.evaluate(async (link: HTMLAnchorElement) =>
        Array.from(new Uint8Array(await (await fetch(link.href)).arrayBuffer())));
    const decoded = decodePng(Buffer.from(png));
    expect([decoded.width, decoded.height]).toEqual([45, 32]);
    const downloaded: number[] = [];
    for (let i = 0; i < decoded.rgba.length; i += 4) {
        downloaded.push((decoded.rgba[i] << 16) | (decoded.rgba[i + 1] << 8) | decoded.rgba[i + 2]);
    }
    expect(downloaded).toEqual(expected.rgb);
    await expect(page.getByRole('status')).toBeEmpty();
    await expect(page.getByRole('button', { name: 'Carve' })).toBeEnabled();
    expect(uploads.count).toBe(0);
});

for (const variant of ['java-wasm', 'java-js', 'rust'] as const) {
    test(`carves the golden exactly on ${variant}`, { tag: '@firefox' }, async ({ page }) => {
        const uploads = countUploads(page);
        await page.goto(`/projects/seamCarver?engine=${variant}`);

        await carveGradient(page);

        await expect(page.getByText(LABELS[variant])).toBeVisible();
        expect(await canvasPixels(page, 'Carved image, 45 × 32 px')).toEqual(expected.rgb);
        expect(uploads.count).toBe(0);
    });
}

test("falls back to the Java's JavaScript when its WebAssembly doesn't load", { tag: '@firefox' }, async ({ page }) => {
    // As in a browser without WasmGC or exnref, where compiling it fails
    await page.context().route('**/assets/seamcarver-web/java/*.wasm', route => route.fulfill({
        status: 200, contentType: 'application/wasm', body: Buffer.from('not wasm'),
    }));
    await page.goto('/projects/seamCarver');

    await carveGradient(page);

    await expect(page.getByText(LABELS['java-js'])).toBeVisible();
    expect(await canvasPixels(page, 'Carved image, 45 × 32 px')).toEqual(expected.rgb);
});

test('carves on the Rust engine when asked for the fast one', async ({ page }) => {
    await page.goto('/projects/seamCarver');

    await chooseGradient(page);
    // The switch's label covers its (custom-styled) checkbox
    await page.getByText('Use the fast engine').click();
    await expect(page.getByLabel('Use the fast engine')).toBeChecked();
    await page.getByLabel('Target Width').fill('45');
    await page.getByLabel('Target Height').fill('32');
    await page.getByRole('button', { name: 'Carve' }).click();

    await expect(page.getByText(LABELS.rust)).toBeVisible({ timeout: 30_000 });
    expect(await canvasPixels(page, 'Carved image, 45 × 32 px')).toEqual(expected.rgb);
});

test('routes a large image to Rust with a slow warning, and cancels it', { tag: '@firefox' }, async ({ page }) => {
    const uploads = countUploads(page);
    await page.goto('/projects/seamCarver');

    await chooseGradient(page, 2000, 1500);
    await expect(page.getByText('Chosen image: 2000 × 1500 px.')).toBeVisible({ timeout: 30_000 });
    const fast = page.getByLabel('Use the fast engine');
    await expect(fast).toBeChecked();
    await expect(fast).toBeDisabled();
    await expect(page.getByText(/so it carves images up to 96,048 pixels/)).toBeVisible();

    await page.getByLabel('Target Width').fill('1000');
    await page.getByRole('button', { name: 'Carve' }).click();
    await expect(page.getByText(/^This will take about \d+ s\.$/)).toBeVisible();

    await page.getByRole('button', { name: 'Carve anyway' }).click();
    await expect(page.getByRole('status')).toContainText('Carving with the Rust engine');
    await expect(page.getByRole('button', { name: 'Carve' })).toBeDisabled();
    await expect(page.getByLabel('Target Width')).toBeDisabled();
    await expect(page.getByRole('status')).toContainText(/of 1000 seams/);

    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('status')).toHaveText('Carve cancelled.');
    await expect(page.getByRole('button', { name: 'Carve' })).toBeEnabled();
    await expect(page.getByLabel('Target Width')).toBeEnabled();
    await expect(page.getByLabel('Image File')).toBeEnabled();
    await expect(page.getByRole('img', { name: /Carved image/ })).toHaveCount(0);
    expect(uploads.count).toBe(0);
});

test('rejects target sizes larger than the image before carving', async ({ page }) => {
    await page.goto('/projects/seamCarver');

    await chooseGradient(page);
    await expect(page.getByLabel('Target Width')).toHaveValue('60');
    await page.getByLabel('Target Width').fill('61');
    await page.getByRole('button', { name: 'Carve' }).click();

    await expect(page.getByText("Target width must be <= the input image's width, 60")).toBeVisible();
    await expect(page.getByRole('status')).toBeEmpty();
});
