import { test, expect } from './fixtures';

import { GAMES, gameFrame } from './ppuGames';

test('the backend serves the games as modules, with their memory dumps and screenshots', async ({ request }) => {
    for (const [id] of GAMES) {
        const page = await request.get(`/assets/ppu/${id}/${id}.zgal.html`);
        expect(page.ok()).toBe(true);
        expect(page.headers()['content-type']).toContain('text/html');
        // Browsers only run module scripts served as JavaScript
        for (const script of [`${id}.zgal.main.js`, `${id}.zgal.js`, 'zgal/index.js', 'zgal/main-browser.js']) {
            const response = await request.get(`/assets/ppu/${id}/${script}`);
            expect(response.ok(), script).toBe(true);
            expect(response.headers()['content-type'], script).toMatch(/javascript/);
        }
        expect((await request.get(`/assets/ppu/${id}/assets/ppu_dump.bin`)).ok()).toBe(true);
        expect((await request.get(`/assets/ppu/${id}/screenshot.png`)).headers()['content-type']).toBe('image/png');
    }
});

test('says so when a game can\'t get a WebGPU adapter', async ({ page }) => {
    // Without the switch, headless Chromium has WebGPU but no adapter
    await page.goto('/projects/vkPPU');

    for (const [, title] of GAMES) {
        await gameFrame(page, title).scrollIntoViewIfNeeded();
        await expect(page.getByRole('alert').filter({ hasText: `${title} couldn't run in this browser.` })).toBeVisible({ timeout: 15_000 });
    }
});

test('shows screenshots in browsers without WebGPU', async ({ page }) => {
    await page.addInitScript(() => {
        delete (Navigator.prototype as { gpu?: unknown }).gpu;
    });
    await page.goto('/projects/vkPPU');

    await expect(page.getByRole('alert')).toContainText('These games need a browser that supports WebGPU');
    await expect(page.locator('iframe')).toHaveCount(0);
    for (const [, title] of GAMES) {
        const screenshot = page.getByAltText(title);
        await screenshot.scrollIntoViewIfNeeded();
        await expect.poll(() => screenshot.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(256);
    }
});
