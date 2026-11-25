import { test, expect } from './fixtures';
import { gradientPng } from './png';

const chooseGradient = (page: import('@playwright/test').Page) =>
    page.getByLabel('Image File').setInputFiles({
        name: 'gradient.png',
        mimeType: 'image/png',
        buffer: gradientPng(60, 40),
    });

function countUploads(page: import('@playwright/test').Page) {
    const uploads = { count: 0 };
    page.on('request', request => {
        if (request.url().endsWith('/seamCarver/upload')) uploads.count++;
    });
    return uploads;
}

test('carves an uploaded image to the requested size', async ({ page }) => {
    await page.goto('/projects/seamCarver');

    await chooseGradient(page);
    await expect(page.getByAltText('Input image, 60 × 40 px')).toBeVisible();
    await expect(page.getByText('Chosen image: 60 × 40 px.')).toBeVisible();
    // The targets start at the image's own size
    await expect(page.getByLabel('Target Width')).toHaveValue('60');
    await expect(page.getByLabel('Target Height')).toHaveValue('40');

    await page.getByLabel('Target Width').fill('45');
    await page.getByLabel('Target Height').fill('32');
    await page.getByRole('button', { name: 'Carve' }).click();

    const result = page.getByAltText('Carved image, 45 × 32 px');
    await expect(result).toBeVisible({ timeout: 30_000 });
    const size = await result.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]);
    expect(size).toEqual([45, 32]);
    await expect(page.getByRole('link', { name: 'Download PNG' })).toHaveAttribute('download', 'gradient-45x32.png');
    await expect(page.getByRole('status')).toBeEmpty();
});

test('rejects target sizes larger than the image before uploading', async ({ page }) => {
    const uploads = countUploads(page);
    await page.goto('/projects/seamCarver');

    await chooseGradient(page);
    await expect(page.getByLabel('Target Width')).toHaveValue('60');
    await page.getByLabel('Target Width').fill('61');
    await page.getByRole('button', { name: 'Carve' }).click();

    await expect(page.getByText("Target width must be <= the input image's width, 60")).toBeVisible();
    expect(uploads.count).toBe(0);
});

test('rejects files over 1 MB before uploading', async ({ page }) => {
    const uploads = countUploads(page);
    await page.goto('/projects/seamCarver');

    await page.getByLabel('Image File').setInputFiles({
        name: 'big.png',
        mimeType: 'image/png',
        buffer: Buffer.alloc(1024 * 1024 + 1),
    });

    await expect(page.getByText('Image file too large (max 1 MB)')).toBeVisible();
    await page.getByLabel('Target Width').fill('10');
    await page.getByLabel('Target Height').fill('10');
    await page.getByRole('button', { name: 'Carve' }).click();
    await expect(page.getByText('Image file too large (max 1 MB)')).toBeVisible();
    expect(uploads.count).toBe(0);
});
