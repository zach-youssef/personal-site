import { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { collectErrors } from './pageChecks';

const PAGE = '/projects/splats';
const SCREENSHOT_ALT = 'The viewer\'s start view (screenshot)';
// ./build-splat's screenshot is drawn at the viewer's --size
const SCREENSHOT_WIDTH = 1280;

// The scene's files: none of the tests here may download them
function sceneRequests(page: Page): string[] {
    const requests: string[] = [];
    page.on('request', request => {
        if (new URL(request.url()).pathname.startsWith('/assets/splat/scene/')) {
            requests.push(request.url());
        }
    });
    return requests;
}

test('the projects page links to the viewer\'s page', async ({ page }) => {
    await page.goto('/projects');
    const title = page.locator('.card-title', { hasText: /^Gaussian Splatting$/ });
    await page.locator('.card').filter({ has: title }).getByRole('link', { name: 'View' }).click();

    await expect(page).toHaveURL(PAGE);
    await expect(page.getByRole('heading', { name: 'Gaussian Splatting', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View on GitHub', exact: true })).toHaveAttribute('href', 'https://github.com/zach-youssef/vk_splats');
    await expect(page.getByRole('link', { name: 'About ZGAL', exact: true })).toHaveAttribute('href', '/projects/zgal');
});

test('the backend serves the scene\'s description, the viewer\'s main, the scene and the screenshot', async ({ request }) => {
    const response = await request.get('/assets/splat/scene.json');
    expect(response.ok()).toBe(true);
    const scene = await response.json();

    const main = await request.get(scene.viewer);
    expect(main.ok()).toBe(true);
    expect(main.headers()['content-type']).toMatch(/javascript/);
    for (const file of [scene.stream, scene.cameras]) {
        const body = await request.get(file.path);
        expect(body.ok(), file.path).toBe(true);
        expect((await body.body()).length, file.path).toBe(file.bytes);
    }
    expect((await request.get(scene.screenshot)).headers()['content-type']).toBe('image/webp');
});

test('shows the controls, and the screenshot in browsers without WebGPU', async ({ page }) => {
    const errors = collectErrors(page);
    const downloads = sceneRequests(page);
    await page.addInitScript(() => {
        delete (Navigator.prototype as { gpu?: unknown }).gpu;
    });
    await page.goto(PAGE);

    await expect(page.getByRole('alert')).toContainText('The viewer needs a browser that supports WebGPU');
    const screenshot = page.getByAltText(SCREENSHOT_ALT);
    await expect.poll(() => screenshot.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(SCREENSHOT_WIDTH);
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Controls', exact: true })).toBeVisible();
    await expect(page.getByRole('definition')).toHaveText([
        'move forward, left, back, right', 'sink, rise', 'look around (with the mouse or one finger)',
        'move faster (up) or slower (down)', 'stop the viewer',
    ]);
    // The viewer's source and the scene's release
    await expect(page.getByRole('link', { name: /^Scene: release / })).toHaveAttribute('href', /^https:\/\/github\.com\/zach-youssef\/vk_splats\/releases\/tag\//);
    expect(downloads).toEqual([]);
    expect(errors).toEqual([]);
});

test('shows touch devices a poster, which downloads nothing until asked', async ({ page }) => {
    const downloads = sceneRequests(page);
    // A coarse primary pointer, as on phones and tablets
    await page.addInitScript(() => {
        const matchMedia = window.matchMedia.bind(window);
        // The real MediaQueryList (its listeners and methods, bound to it), but matching
        window.matchMedia = query => {
            const list = matchMedia(query);
            return query !== '(pointer: coarse)' ? list : new Proxy(list, {
                get: (target, key) => {
                    if (key === 'matches') {
                        return true;
                    }
                    const value = Reflect.get(target, key, target);
                    return typeof value === 'function' ? value.bind(target) : value;
                },
            });
        };
    });
    await page.goto(PAGE);

    const start = page.getByRole('button', { name: /^View in 3D \(\d+ MB\)$/ });
    await expect(start).toBeVisible();
    await expect(page.getByAltText(SCREENSHOT_ALT)).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(downloads).toEqual([]);

    // Headless Chromium has WebGPU but, without the WebGPU specs' switches, no adapter
    await start.click();
    await expect(page.getByRole('alert')).toContainText('The viewer couldn\'t run in this browser', { timeout: 15_000 });
    await expect(page.getByAltText(SCREENSHOT_ALT)).toBeVisible();
});

test('says so when the viewer can\'t get a WebGPU adapter', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(PAGE);

    await expect(page.getByRole('alert')).toContainText('The viewer couldn\'t run in this browser', { timeout: 15_000 });
    await expect(page.getByAltText(SCREENSHOT_ALT)).toBeVisible();
    expect(errors).toEqual([]);
});
