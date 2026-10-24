import { test, expect } from './fixtures';
import { collectErrors, colorCount } from './pageChecks';
import { GAMES, gameFrame } from './ppuGames';
import { WEBGPU_LAUNCH_OPTIONS } from './webgpu';

test.use({ launchOptions: WEBGPU_LAUNCH_OPTIONS });

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
