import { test, expect } from './fixtures';
import { collectErrors, colorCount } from './pageChecks';
import { WEBGPU_LAUNCH_OPTIONS } from './webgpu';

test.use({ launchOptions: WEBGPU_LAUNCH_OPTIONS });

// Each example the page offers, at the URL that selects it; particles is the default
const SAMPLES = [
    { title: 'Particles', path: '/projects/zgal' },
    { title: 'Scene', path: '/projects/zgal?sample=scene' },
];

for (const { title, path } of SAMPLES) {
    test(`runs the ${title.toLowerCase()} example in the page`, async ({ page }) => {
        // Scene's shadow map, PBR and tonemap passes are slow on SwiftShader
        test.setTimeout(90_000);
        const errors = collectErrors(page);
        await page.goto(path);

        const frame = page.locator(`iframe[title="${title}"]`);
        const program = frame.contentFrame();
        await expect(program.locator('html')).toHaveAttribute('data-zgal', 'running', { timeout: 30_000 });
        // A drawn canvas, rather than a cleared one, after drawing frames without errors, which the
        // runner would show over it
        await expect.poll(() => colorCount(page, program.locator('canvas')), { timeout: 30_000 }).toBeGreaterThan(100);
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
}
