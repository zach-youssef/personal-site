import { test, expect } from './fixtures';
import { Page } from '@playwright/test';

// The page backgrounds of the two compiled themes
const LIGHT_BACKGROUND = 'rgb(245, 241, 232)';
const DARK_BACKGROUND = 'rgb(29, 33, 37)';

const bodyBackground = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const themeSwitch = (page: Page) => page.getByRole('switch', { name: 'Dark mode' });

test.describe('with a light system theme', () => {
    test.use({ colorScheme: 'light' });

    test('starts light, toggles to dark and keeps the choice after reloading', async ({ page }) => {
        await page.goto('/');
        await expect(themeSwitch(page)).not.toBeChecked();
        expect(await bodyBackground(page)).toBe(LIGHT_BACKGROUND);
        await expect(page.locator('.navbar')).toHaveClass(/navbar-light/);

        // The custom switch hides the input behind its label, so click what visitors see
        await page.locator('label[for="theme-toggle"]').click();
        await expect(themeSwitch(page)).toBeChecked();
        expect(await bodyBackground(page)).toBe(DARK_BACKGROUND);
        await expect(page.locator('.navbar')).toHaveClass(/navbar-dark/);

        await page.goto('/projects');
        await expect(themeSwitch(page)).toBeChecked();
        expect(await bodyBackground(page)).toBe(DARK_BACKGROUND);
    });
});

test.describe('with a dark system theme', () => {
    test.use({ colorScheme: 'dark' });

    test('starts dark', async ({ page }) => {
        await page.goto('/');
        await expect(themeSwitch(page)).toBeChecked();
        expect(await bodyBackground(page)).toBe(DARK_BACKGROUND);
    });
});

test('keeps the switch in the header bar on small phones', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');

    // Brand, switch and menu button share one row, so the bar stays a single line high
    const navbar = await page.locator('.navbar').boundingBox();
    const toggler = await page.locator('.navbar-toggler').boundingBox();
    const brand = await page.locator('.navbar-brand').boundingBox();
    expect(navbar!.height).toBeLessThan(70);
    expect(Math.abs((toggler!.y + toggler!.height / 2) - (brand!.y + brand!.height / 2))).toBeLessThan(4);
    await expect(page.locator('label[for="theme-toggle"]')).toBeInViewport();
});
