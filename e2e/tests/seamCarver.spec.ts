import { test, expect } from './fixtures';
import { gradientPng } from './png';

test('carves an uploaded image to the requested size', async ({ page }) => {
    await page.goto('/projects/seamCarver');

    await page.getByLabel('Image File').setInputFiles({
        name: 'gradient.png',
        mimeType: 'image/png',
        buffer: gradientPng(60, 40),
    });
    await page.locator('input[name="width"]').fill('45');
    await page.locator('input[name="height"]').fill('32');
    await page.getByRole('button', { name: 'Carve' }).click();

    await expect(page.getByAltText('Input file')).toBeVisible();
    const result = page.getByAltText('Seam Carving Result');
    await expect(result).toBeVisible({ timeout: 30_000 });
    const size = await result.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]);
    expect(size).toEqual([45, 32]);
});

test('rejects target sizes larger than the image before uploading', async ({ page }) => {
    let uploads = 0;
    page.on('request', request => {
        if (request.url().endsWith('/seamCarver/upload')) uploads++;
    });
    await page.goto('/projects/seamCarver');

    await page.getByLabel('Image File').setInputFiles({
        name: 'gradient.png',
        mimeType: 'image/png',
        buffer: gradientPng(60, 40),
    });
    await page.locator('input[name="width"]').fill('61');
    await page.locator('input[name="height"]').fill('40');
    await page.getByRole('button', { name: 'Carve' }).click();

    await expect(page.getByText(/must <= the input image's width, 60/)).toBeVisible();
    expect(uploads).toBe(0);
});
