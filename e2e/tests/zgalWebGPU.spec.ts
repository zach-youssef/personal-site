import { test, expect } from './fixtures';
import { collectErrors, colorCount } from './pageChecks';
import { WEBGPU_LAUNCH_OPTIONS } from './webgpu';

test.use({ launchOptions: WEBGPU_LAUNCH_OPTIONS });

test('runs the particles example in the page', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/projects/zgal');

    const frame = page.locator('iframe[title="Particles"]');
    const program = frame.contentFrame();
    await expect(program.locator('html')).toHaveAttribute('data-zgal', 'running', { timeout: 15_000 });
    // Particles in the canvas, rather than a cleared one, after drawing frames without errors,
    // which the runner would show over it
    await expect.poll(() => colorCount(page, program.locator('canvas')), { timeout: 15_000 }).toBeGreaterThan(100);
    await expect(program.locator('#zgal-message')).toHaveCount(0);
    await expect(program.locator('html')).toHaveAttribute('data-zgal', 'running');
    // Scaled to the frame rather than cropped by it, and smoothly rather than pixelated
    const frameBox = (await frame.boundingBox())!;
    const canvasBox = (await program.locator('canvas').boundingBox())!;
    expect(canvasBox.x).toBeCloseTo(frameBox.x, 0);
    expect(canvasBox.y).toBeCloseTo(frameBox.y, 0);
    expect(canvasBox.width).toBeCloseTo(frameBox.width, 0);
    expect(canvasBox.height).toBeCloseTo(frameBox.height, 0);
    await expect(program.locator('canvas')).toHaveCSS('image-rendering', 'auto');
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);
});
