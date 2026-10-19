import { test, expect } from './fixtures';
import { collectErrors, colorCount } from './pageChecks';
import { GAMES, gameFrame } from './ppuGames';

// Headless Chromium only has a WebGPU adapter with --enable-unsafe-webgpu, and it's SwiftShader, whose
// canvases the games can't draw into, unless --enable-gpu gives it the real GPU. Launch options
// apply to the whole file, as they need their own browser.
test.use({ launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu'] } });

test('runs both games in the page', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/projects/vkPPU');

    await expect(page.getByRole('link', { name: 'View on GitHub' })).toHaveAttribute('href', 'https://github.com/zach-youssef/vk_ppu');
    for (const [, title] of GAMES) {
        const frame = gameFrame(page, title);
        await frame.scrollIntoViewIfNeeded();
        const game = frame.contentFrame();
        await expect(game.locator('html')).toHaveAttribute('data-zgal', 'running', { timeout: 15_000 });
        // A title screen in the canvas, rather than a cleared one, after drawing frames without
        // errors, which the runner would show over it
        await expect.poll(() => colorCount(page, game.locator('canvas')), { timeout: 15_000 }).toBeGreaterThan(4);
        await expect(game.locator('#zgal-message')).toHaveCount(0);
        await expect(game.locator('html')).toHaveAttribute('data-zgal', 'running');
    }
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);
});
