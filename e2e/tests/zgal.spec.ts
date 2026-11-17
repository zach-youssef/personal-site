import { test, expect } from './fixtures';

// The examples ./build-zgal copies, each with what it loads besides its page and scripts, a form its
// source contains, and whether it has a screenshot (image_filter has no window)
const PROGRAMS = [
    { name: 'particles', assets: [], source: '(graph ParticlesGraph', screenshot: true },
    { name: 'scene', assets: ['assets/scene.gltf', 'assets/scene.bin'], source: '(graph SceneGraph', screenshot: true },
    // Its default input, which its page's ?arg=input.png and runHeadless's args name
    { name: 'image_filter', assets: ['assets/input.png'], source: '(graph FilterGraph', screenshot: false },
];

for (const { name, assets, source, screenshot } of PROGRAMS) {
    test(`the backend serves the ${name} example as modules, with its assets and source`, async ({ request }) => {
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
        if (screenshot) {
            expect((await request.get(`${dir}/screenshot.webp`)).headers()['content-type']).toBe('image/webp');
        }
    });
}

test('the backend serves image_filter\'s input and its output filtered at build time, for browsers without WebGPU', async ({ request }) => {
    const dir = '/assets/zgal/image_filter';
    // To show, compressed; and the output losslessly, which a browser's run is compared with
    for (const [file, type] of [['input.webp', 'image/webp'], ['blur_edges.webp', 'image/webp'], ['blur_edges.png', 'image/png']]) {
        const response = await request.get(`${dir}/${file}`);
        expect(response.ok(), file).toBe(true);
        expect(response.headers()['content-type'], file).toBe(type);
        expect((await response.body()).length, file).toBeGreaterThan(0);
    }
});

test('shows the program\'s source', async ({ page }) => {
    await page.goto('/projects/zgal');

    await expect(page.getByRole('link', { name: 'View on GitHub', exact: true })).toHaveAttribute('href', 'https://github.com/zach-youssef/vulkan_testing');
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

// Each example the page offers, at the URL that selects it (particles is the default), and the width
// of its screenshot
const SAMPLES = [
    { title: 'Particles', path: '/projects/zgal', screenshotWidth: 1024 },
    { title: 'Scene', path: '/projects/zgal?sample=scene', screenshotWidth: 1280 },
];

test('switches examples from the selector, and records the choice in the URL', async ({ page }) => {
    await page.goto('/projects/zgal');
    const selector = page.getByRole('group', { name: 'Example' });
    await expect(selector.getByRole('button', { name: 'Particles' })).toHaveAttribute('aria-pressed', 'true');
    // Clickable, and in the theme's colours
    await expect(selector.getByRole('button', { name: 'Scene' })).toHaveCSS('cursor', 'pointer');

    await selector.getByRole('button', { name: 'Scene' }).click();

    await expect(page).toHaveURL(/\/projects\/zgal\?sample=scene$/);
    await expect(selector.getByRole('button', { name: 'Scene' })).toHaveAttribute('aria-pressed', 'true');
    await expect(selector.getByRole('button', { name: 'Scene' })).toHaveClass(/btn-primary/);
    await expect(page.locator('iframe[title="Scene"]')).toHaveAttribute('src', '/assets/zgal/scene/scene.zgal.html');
    await expect(page.locator('iframe[title="Particles"]')).toHaveCount(0);
    await expect(page.getByLabel('scene.zgal')).toContainText('(graph SceneGraph');
    // No focus ring left on the clicked button (it's only for keyboard focus)
    await expect(selector.getByRole('button', { name: 'Scene' })).toHaveCSS('box-shadow', 'none');

    // A deep link opens the page on its example
    await page.reload();
    await expect(selector.getByRole('button', { name: 'Scene' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('iframe[title="Scene"]')).toHaveCount(1);
});

for (const { title, path, screenshotWidth } of SAMPLES) {
    test(`says so when the ${title.toLowerCase()} example can't get a WebGPU adapter`, async ({ page }) => {
        // Without the switch, headless Chromium has WebGPU but no adapter
        await page.goto(path);

        await expect(page.getByRole('alert').filter({ hasText: `${title} couldn't run in this browser.` })).toBeVisible({ timeout: 15_000 });
    });

    test(`shows a screenshot of the ${title.toLowerCase()} example in browsers without WebGPU`, async ({ page }) => {
        await page.addInitScript(() => {
            delete (Navigator.prototype as { gpu?: unknown }).gpu;
        });
        await page.goto(path);

        await expect(page.getByRole('alert')).toContainText('This program needs a browser that supports WebGPU');
        await expect(page.locator('iframe')).toHaveCount(0);
        const screenshot = page.getByAltText(title);
        await expect.poll(() => screenshot.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(screenshotWidth);
    });
}

test.describe('the image filter', () => {
    test('says so, and shows what it made at build time, when it can\'t get a WebGPU adapter', async ({ page }) => {
        // Without the switch, headless Chromium has WebGPU but no adapter
        await page.goto('/projects/zgal?sample=image_filter');

        await expect(page.getByRole('alert').filter({ hasText: "Image filter couldn't run in this browser." })).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('.image-filter')).toHaveAttribute('data-zgal', 'failed');
        await expect(page.getByAltText('Image filter output')).toHaveAttribute('src', '/assets/zgal/image_filter/blur_edges.webp');
    });

    test('shows its input and the output filtered at build time in browsers without WebGPU', async ({ page }) => {
        await page.addInitScript(() => {
            delete (Navigator.prototype as { gpu?: unknown }).gpu;
        });
        await page.goto('/projects/zgal?sample=image_filter');

        await expect(page.getByRole('alert')).toContainText('This program needs a browser that supports WebGPU');
        await expect(page.locator('[data-option]')).toHaveCount(0);
        for (const [alt, width] of [['Image filter input', 128], ['Image filter output', 128]] as const) {
            const image = page.getByAltText(alt);
            await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBe(width);
        }
        await expect(page.getByLabel('image_filter.zgal')).toContainText('(graph FilterGraph');
        // Highlighted as the other listings are
        await expect(page.getByLabel('image_filter.zgal').locator('.zgal-comment').first()).toBeVisible();
        await expect(page.getByLabel('image_filter.zgal').locator('.zgal-head').first()).toBeVisible();
    });
});
