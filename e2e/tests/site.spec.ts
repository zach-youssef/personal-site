import { test, expect } from './fixtures';

test('home page lists the featured projects from the backend', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['About Me', 'Featured Projects']);
    await expect(page.locator('.featured-projects .card-title')).toHaveText(['Vulkan Retro PPU', 'ZGAL']);
    await expect(page.getByText('Vulkan Compute Pipeline for rendering NES games')).toBeVisible();
    await expect(page.getByText('A language for GPU programs that compiles to Vulkan and WebGPU')).toBeVisible();
});

for (const [name, id] of [['Vulkan Retro PPU', 'vkPPU'], ['ZGAL', 'zgal']]) {
    test(`featured ${name} links to its project page`, async ({ page }) => {
        await page.goto('/');
        await page.locator('.card').filter({ hasText: name }).getByRole('link', { name: 'View' }).click();

        await expect(page).toHaveURL(`/projects/${id}`);
        await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    });
}

test('see more ends the featured projects, as wide as their cards, and opens the projects page', async ({ page }) => {
    for (const width of [1280, 400]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/');
        const seeMore = page.getByRole('link', { name: 'See more' });
        const cards = page.locator('.featured-projects > .card');
        await expect(cards).toHaveCount(2);

        const button = (await seeMore.boundingBox())!;
        for (const card of await cards.all()) {
            const box = (await card.boundingBox())!;
            expect(button.x, `${width}px`).toBeCloseTo(box.x, 0);
            expect(button.width, `${width}px`).toBeCloseTo(box.width, 0);
            expect(button.y, `${width}px`).toBeGreaterThan(box.y + box.height);
        }
    }

    await page.getByRole('link', { name: 'See more' }).click();
    await expect(page).toHaveURL('/projects');
    await expect(page.getByRole('heading', { name: 'Side Projects' })).toBeVisible();
});

test('projects page lists every project by category', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Projects' }).click();

    await expect(page).toHaveURL('/projects');
    // Side projects first
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Side Projects', 'Professional Work', 'University Projects']);
    for (const name of ['Broad Museum AR Experience', 'Sokoban AI', 'Seam Carver', 'Vulkan Retro PPU', 'ZGAL']) {
        await expect(page.getByText(name, { exact: true })).toBeVisible();
    }
    // 2 professional, 5 university and 2 personal projects
    await expect(page.getByRole('link', { name: 'View' })).toHaveCount(9);
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

    for (const path of ['/', '/projects', '/projects/sokoban', '/projects/seamCarver', '/projects/raytracer', '/projects/webglDemo', '/projects/zgal']) {
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
