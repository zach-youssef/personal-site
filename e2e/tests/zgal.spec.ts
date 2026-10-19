import { test, expect } from './fixtures';

const PROGRAM_DIR = '/assets/zgal/particles';

test('the backend serves the particles example as modules, with its source and screenshot', async ({ request }) => {
    const page = await request.get(`${PROGRAM_DIR}/particles.zgal.html`);
    expect(page.ok()).toBe(true);
    expect(page.headers()['content-type']).toContain('text/html');
    // Browsers only run module scripts served as JavaScript
    for (const script of ['particles.zgal.main.js', 'particles.zgal.js', 'zgal/index.js', 'zgal/main-browser.js']) {
        const response = await request.get(`${PROGRAM_DIR}/${script}`);
        expect(response.ok(), script).toBe(true);
        expect(response.headers()['content-type'], script).toMatch(/javascript/);
    }
    expect(await (await request.get(`${PROGRAM_DIR}/particles.zgal`)).text()).toContain('(graph ParticlesGraph');
    expect((await request.get(`${PROGRAM_DIR}/screenshot.webp`)).headers()['content-type']).toBe('image/webp');
});

test('shows the program\'s source', async ({ page }) => {
    await page.goto('/projects/zgal');

    await expect(page.getByRole('link', { name: 'View on GitHub' })).toHaveAttribute('href', 'https://github.com/zach-youssef/vulkan_testing');
    await expect(page.getByLabel('particles.zgal')).toContainText('(compute-material ParticleSim');
});

test('links to the documentation, which the backend serves with its stylesheets and scripts', async ({ page }) => {
    const failed: string[] = [];
    page.on('response', response => {
        if (!response.ok()) {
            failed.push(`${response.status()} ${response.url()}`);
        }
    });
    await page.goto('/projects/zgal');
    await page.getByRole('link', { name: 'Read the documentation' }).click();

    await expect(page).toHaveURL(/\/zgal\/docs\/$/);
    await expect(page).toHaveTitle(/ZGAL/);
    // The page's four stylesheets, which only load from the directory's URL; the scripts and the
    // fonts the stylesheets import must load too
    await expect.poll(() => page.evaluate(() =>
        [...document.styleSheets].filter(sheet => sheet.cssRules.length > 0).length)).toBe(4);
    expect(failed).toEqual([]);
});

test('redirects the documentation\'s bare URL to its directory', async ({ request }) => {
    const response = await request.get('/zgal/docs', { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers()['location']).toBe('/zgal/docs/');
});

test('says so when the example can\'t get a WebGPU adapter', async ({ page }) => {
    // Without the switch, headless Chromium has WebGPU but no adapter
    await page.goto('/projects/zgal');

    await expect(page.getByRole('alert').filter({ hasText: 'Particles couldn\'t run in this browser.' })).toBeVisible({ timeout: 15_000 });
});

test('shows a screenshot in browsers without WebGPU', async ({ page }) => {
    await page.addInitScript(() => {
        delete (Navigator.prototype as { gpu?: unknown }).gpu;
    });
    await page.goto('/projects/zgal');

    await expect(page.getByRole('alert')).toContainText('This program needs a browser that supports WebGPU');
    await expect(page.locator('iframe')).toHaveCount(0);
    const screenshot = page.getByAltText('Particles');
    await expect.poll(() => screenshot.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(1024);
});
