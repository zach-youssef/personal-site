import { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { gradientPng } from './png';
import { readGolden } from './seamCarverGoldens';

// The seam carver page's visualisation steps through the carve on the Rust engine, whose energy map
// and seams are the Java's: the energy view must draw exactly the Java's toEnergyImage.

// gradientPng(60, 40)'s energy map, from the Java's GraphImage.toEnergyImage on the JVM
const energy = readGolden('e2e-gradient.energy');

async function chooseGradient(page: Page, width = '45', height = '32') {
    await page.goto('/projects/seamCarver');
    await page.getByLabel('Image File').setInputFiles({ name: 'gradient.png', mimeType: 'image/png', buffer: gradientPng(60, 40) });
    await expect(page.getByAltText('Input image, 60 × 40 px')).toBeVisible();
    await page.getByLabel('Target Width').fill(width);
    await page.getByLabel('Target Height').fill(height);
}

const status = (page: Page) => page.locator('#seamCarverViewStatus');

// The view canvas's 0x00RRGGBB pixels
const canvasPixels = (page: Page, name: string) =>
    page.getByRole('img', { name }).evaluate((canvas: HTMLCanvasElement) => {
        const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
        const rgb: number[] = [];
        for (let i = 0; i < data.length; i += 4) rgb.push((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
        return rgb;
    });

// The overlay's squares, as [x, y] pixels
async function seamSquares(page: Page) {
    const d = await page.getByTestId('seamCarverNextSeam').locator('path').getAttribute('d');
    return [...d!.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map(m => [Number(m[1]), Number(m[2])]);
}

test("draws the Java's energy map of the image", { tag: '@firefox' }, async ({ page }, testInfo) => {
    await chooseGradient(page);
    await expect(status(page)).toHaveText('60 × 40 px, 0 seams removed. Next: a vertical seam.');
    await page.getByRole('button', { name: 'Energy' }).click();
    await expect(page.getByRole('img', { name: 'Energy map, 60 × 40 px' })).toBeVisible({ timeout: 30_000 });
    expect(await canvasPixels(page, 'Energy map, 60 × 40 px')).toEqual(energy.rgb);
    await page.locator('section', { has: page.getByRole('heading', { name: 'Step through the carve' }) })
        .screenshot({ path: testInfo.outputPath('energy.png') });

    // A step keeps the energy view, a pixel narrower
    await page.getByRole('button', { name: 'Step' }).click();
    await expect(page.getByRole('img', { name: 'Energy map, 59 × 40 px' })).toBeVisible();
    await expect(status(page)).toHaveText('59 × 40 px, 1 seam removed. Next: a vertical seam.');
});

test('overlays the next seam, one pixel per row, and steps through the carve to the target', { tag: '@firefox' }, async ({ page }, testInfo) => {
    await chooseGradient(page, '58', '39');
    // Clicked by its label, as a visitor does (Bootstrap's switch draws over its input)
    await page.getByText('Show the next seam').click();
    await expect(page.getByLabel('Show the next seam')).toBeChecked();
    await expect(page.getByTestId('seamCarverNextSeam')).toBeVisible({ timeout: 30_000 });

    // A connected seam: a pixel in each row, each within one column of the last
    const vertical = await seamSquares(page);
    expect(vertical.map(([, y]) => y)).toEqual([...Array(40).keys()]);
    vertical.slice(1).forEach(([x], i) => expect(Math.abs(x - vertical[i][0])).toBeLessThanOrEqual(1));
    await page.locator('section', { has: page.getByRole('heading', { name: 'Step through the carve' }) })
        .screenshot({ path: testInfo.outputPath('overlay.png') });

    const step = page.getByRole('button', { name: 'Step' });
    await step.click();
    await expect(status(page)).toHaveText('59 × 40 px, 1 seam removed. Next: a vertical seam.');
    await step.click();
    await expect(status(page)).toHaveText('58 × 40 px, 2 seams removed. Next: a horizontal seam.');
    // A horizontal seam: a pixel in each column
    await expect.poll(async () => (await seamSquares(page)).map(([x]) => x)).toEqual([...Array(58).keys()]);
    await step.click();
    await expect(status(page)).toHaveText('58 × 39 px, 3 seams removed. At the target size.');
    await expect(step).toBeDisabled();
    await expect(page.getByTestId('seamCarverNextSeam')).toHaveCount(0);
});

test('plays to the target', async ({ page }) => {
    await chooseGradient(page, '50', '35');
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(status(page)).toHaveText('50 × 35 px, 15 seams removed. At the target size.', { timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Play' })).toBeDisabled();
    await page.getByRole('button', { name: 'Start over' }).click();
    await expect(status(page)).toHaveText('60 × 40 px, 0 seams removed. Next: a vertical seam.');
});

test('offers Step but not Play to visitors who prefer reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await chooseGradient(page);
    await expect(page.getByRole('button', { name: 'Step' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Play' })).toHaveCount(0);
});
