import { test, expect } from './fixtures';
import { Locator, Page } from '@playwright/test';
import { collectErrors, colorCount } from './pageChecks';

// The canvas is cleared to black before the scene loads, while the textured, lit castle has
// thousands of colors
async function expectDrawn(page: Page, canvas: Locator): Promise<void> {
    await expect.poll(() => colorCount(page, canvas), { timeout: 15_000 }).toBeGreaterThan(1000);
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
