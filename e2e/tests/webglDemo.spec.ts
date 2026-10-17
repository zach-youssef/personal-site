import { test, expect } from './fixtures';
import { Locator, Page } from '@playwright/test';

// Counts the distinct colors in a screenshot of the canvas. The canvas is cleared to black
// before the scene loads, while the textured, lit castle has thousands of colors.
async function colorCount(page: Page, canvas: Locator): Promise<number> {
    const png = await canvas.screenshot();
    return page.evaluate(async dataUrl => {
        const image = new Image();
        image.src = dataUrl;
        await image.decode();
        const decoded = document.createElement('canvas');
        decoded.width = image.width;
        decoded.height = image.height;
        const context = decoded.getContext('2d')!;
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, image.width, image.height).data;
        const colors = new Set<number>();
        for (let i = 0; i < pixels.length; i += 4) {
            colors.add((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]);
        }
        return colors.size;
    }, `data:image/png;base64,${png.toString('base64')}`);
}

async function expectDrawn(page: Page, canvas: Locator): Promise<void> {
    await expect.poll(() => colorCount(page, canvas), { timeout: 15_000 }).toBeGreaterThan(1000);
}

function collectErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('console', message => {
        if (message.type() === 'error') {
            errors.push(message.text());
        }
    });
    page.on('pageerror', error => errors.push(error.message));
    return errors;
}

test('webgl demo draws the scene in the page', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/projects/webglDemo');
    const canvas = page.getByLabel('WebGL Demo');

    // The canvas is part of the page rather than an embedded one
    await expect(page.locator('iframe')).toHaveCount(0);
    await expectDrawn(page, canvas);
    await expect(page.getByText(/^Frame rate: \d+\.\d$/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);
});

test('webgl demo keeps drawing from every camera and with the plane path', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/projects/webglDemo');
    const canvas = page.getByLabel('WebGL Demo');
    await expectDrawn(page, canvas);

    for (const button of ['Top', 'Rotate', 'Plane', 'Ground']) {
        await page.getByRole('button', { name: button }).click();
        await expectDrawn(page, canvas);
    }
    await page.getByText('Plane Path').click();
    await expect(page.getByRole('switch', { name: 'Plane Path' })).toBeChecked();
    await page.getByRole('button', { name: 'Front' }).click();
    await expectDrawn(page, canvas);
    expect(errors).toEqual([]);
});
