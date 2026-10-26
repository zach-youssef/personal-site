import { test, expect } from './fixtures';

// The examples ./build-zgal copies, each with what it loads besides its page and scripts, and a form
// its source contains
const PROGRAMS = [
    { name: 'particles', assets: [], source: '(graph ParticlesGraph' },
    { name: 'scene', assets: ['assets/scene.gltf', 'assets/scene.bin'], source: '(graph SceneGraph' },
];

for (const { name, assets, source } of PROGRAMS) {
    test(`the backend serves the ${name} example as modules, with its assets, source and screenshot`, async ({ request }) => {
        const dir = `/assets/zgal/${name}`;
        const page = await request.get(`${dir}/${name}.zgal.html`);
        expect(page.ok()).toBe(true);
        expect(page.headers()['content-type']).toContain('text/html');
        // Browsers only run module scripts served as JavaScript
        for (const script of [`${name}.zgal.main.js`, `${name}.zgal.js`, 'zgal/index.js', 'zgal/main-browser.js']) {
            const response = await request.get(`${dir}/${script}`);
            expect(response.ok(), script).toBe(true);
            expect(response.headers()['content-type'], script).toMatch(/javascript/);
        }
        for (const asset of assets) {
            const response = await request.get(`${dir}/${asset}`);
            expect(response.ok(), asset).toBe(true);
            expect((await response.body()).length, asset).toBeGreaterThan(0);
        }
        expect(await (await request.get(`${dir}/${name}.zgal`)).text()).toContain(source);
        expect((await request.get(`${dir}/screenshot.webp`)).headers()['content-type']).toBe('image/webp');
    });
}

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
