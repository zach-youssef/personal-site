import { test, expect } from './fixtures';

test('home page shows the featured project from the backend', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'About Me' })).toBeVisible();
    await expect(page.getByText('Featured: Vulkan Retro PPU')).toBeVisible();
    await expect(page.getByText('Vulkan Compute Pipeline for rendering NES games')).toBeVisible();
});

test('featured project links to its project page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'View' }).click();

    await expect(page).toHaveURL('/projects/vkPPU');
    await expect(page.getByRole('heading', { name: 'Vulkan Retro PPU' })).toBeVisible();
});

test('projects page lists every project by category', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Projects' }).click();

    await expect(page).toHaveURL('/projects');
    for (const heading of ['Professional Work', 'University Projects', 'Side Projects']) {
        await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }
    for (const name of ['Broad Museum AR Experience', 'Sokoban AI', 'Seam Carver', 'Vulkan Retro PPU']) {
        await expect(page.getByText(name, { exact: true })).toBeVisible();
    }
    // 2 professional, 5 university and 1 personal project
    await expect(page.getByRole('link', { name: 'View' })).toHaveCount(8);
});

test('project cards link to their demo pages', async ({ page }) => {
    await page.goto('/projects');

    const sokobanCard = page.locator('.card').filter({ hasText: 'Sokoban AI' });
    await sokobanCard.getByRole('link', { name: 'View' }).click();

    await expect(page).toHaveURL('/projects/sokoban');
    await expect(page.getByRole('button', { name: 'Level Select' })).toBeVisible();
});

for (const [id, url] of [
    ['foundationDbFs', 'https://github.com/zach-youssef/foundationdb-fs'],
    ['broadAR', 'https://buck.co/work/meta-x-murakami-at-the-broad'],
    ['metaAvatars', 'https://www.theverge.com/2024/9/25/24254331/meta-metaverse-avatars-glow-up-connect-2024'],
]) {
    test(`/projects/${id} redirects to its external page`, async ({ page }) => {
        await page.goto(`/projects/${id}`);

        await expect(page).toHaveURL(url);
    });
}

// Requests to another origin, like the hard-coded http://zyoussef.com URLs this replaced,
// would be blocked as mixed content once the site is served over https
test('pages only request their own origin', async ({ page, baseURL }) => {
    const crossOrigin: string[] = [];
    page.on('request', request => {
        if (new URL(request.url()).origin !== new URL(baseURL!).origin) {
            crossOrigin.push(request.url());
        }
    });

    for (const path of ['/', '/projects', '/projects/sokoban', '/projects/seamCarver', '/projects/raytracer', '/projects/webglDemo']) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
    }

    expect(crossOrigin).toEqual([]);
});

test('project thumbnails load from the backend', async ({ page }) => {
    await page.goto('/projects');
    const thumbnails = page.locator('.card-img-top');
    await expect(thumbnails.first()).toBeVisible();

    for (const thumbnail of await thumbnails.all()) {
        // Thumbnails load lazily, as they're scrolled to
        await thumbnail.scrollIntoViewIfNeeded();
        await expect.poll(() => thumbnail.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    }
});
