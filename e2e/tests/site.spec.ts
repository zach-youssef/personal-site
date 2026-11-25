import { test, expect } from './fixtures';

test('home page lists the featured projects from the backend', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['About Me', 'Featured Projects']);
    await expect(page.locator('.featured-projects .card-title')).toHaveText(['ZGAL', 'Gaussian Splatting']);
    await expect(page.getByText('A language for GPU programs that compiles to Vulkan and WebGPU')).toBeVisible();
    await expect(page.getByText('A 3D Gaussian splatting trainer and real-time viewer written in ZGAL, running in the browser with WebGPU')).toBeVisible();
});

for (const [name, id] of [['ZGAL', 'zgal'], ['Gaussian Splatting', 'splats']]) {
    test(`featured ${name} links to its project page`, async ({ page }) => {
        await page.goto('/');
        // Match the title exactly: another card's description can mention this name.
        const title = page.locator('.card-title', { hasText: new RegExp(`^${name}$`) });
        await page.locator('.card').filter({ has: title }).getByRole('link', { name: 'View' }).click();

        await expect(page).toHaveURL(`/projects/${id}`);
        await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    });
}

test('see more ends the featured projects, as wide as their cards, and opens the projects page', { tag: '@firefox' }, async ({ page }) => {
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
    // Professional work, then side projects, then university
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Professional Work', 'Side Projects', 'University Projects']);
    for (const name of ['Broad Museum AR Experience', 'Sokoban AI', 'Seam Carver', 'Vulkan Retro PPU', 'ZGAL', 'Gaussian Splatting']) {
        await expect(page.getByText(name, { exact: true })).toBeVisible();
    }
    // 2 professional, 5 university and 3 personal projects
    await expect(page.getByRole('link', { name: 'View' })).toHaveCount(10);
});

test('project cards link to their demo pages', async ({ page }) => {
    await page.goto('/projects');

    const sokobanCard = page.locator('.card').filter({ hasText: 'Sokoban AI' });
    await sokobanCard.getByRole('link', { name: 'View' }).click();

    await expect(page).toHaveURL('/projects/sokoban');
    await expect(page.getByRole('button', { name: 'Level Select' })).toBeVisible();
});

// The FoundationDB-FS page, which used to redirect to its repository: the backend's diagrams,
// drawn inline in the theme's colours, and links. Its video is tested below.
test('the FoundationDB-FS card opens its write-up, with its diagrams and links', async ({ page }) => {
    await page.goto('/projects');
    await page.locator('.card').filter({ hasText: 'FoundationDB-FS' }).getByRole('link', { name: 'View' }).click();

    await expect(page).toHaveURL('/projects/foundationDbFs');
    await expect(page.getByRole('heading', { level: 2, name: 'FoundationDB-FS', exact: true })).toBeVisible();
    const diagrams = page.locator('.writeup-figure svg[role="img"]');
    await expect(diagrams).toHaveCount(6);
    for (const diagram of await diagrams.all()) {
        await expect(diagram).toHaveAttribute('aria-label', /\S/);
        // Laid out, and its text is text, not pixels
        expect((await diagram.boundingBox())!.width).toBeGreaterThan(200);
        await expect(diagram.locator('text').first()).toBeAttached();
    }
    // The theme's stylesheet colours the diagrams' text like the page's, over the files' own
    // light-theme colours
    await page.emulateMedia({ colorScheme: 'dark' });
    const label = diagrams.first().locator('text.wd-text').first();
    const bodyColor = () => page.evaluate(() => getComputedStyle(document.body).color);
    await expect.poll(bodyColor).not.toBe('rgb(54, 42, 48)');
    expect(await label.evaluate(text => getComputedStyle(text).fill)).toBe(await bodyColor());
    expect(await label.getAttribute('fill')).toBe('#362a30');
    await expect(page.getByRole('link', { name: 'View on GitHub' })).toHaveAttribute('href', 'https://github.com/zach-youssef/foundationdb-fs');
    await expect(page.locator('.writeup-links a')).toHaveCount(2);
    await expect(page.locator('.article-card')).toHaveCount(0);
});

// The video loads nothing from YouTube until it's clicked, then exactly the privacy-enhanced
// player's frame, which is answered locally so the test stays offline
test('the FoundationDB-FS video loads from youtube-nocookie.com only when clicked @firefox', async ({ page, baseURL }) => {
    const crossOrigin: string[] = [];
    page.on('request', request => {
        if (new URL(request.url()).origin !== new URL(baseURL!).origin) {
            crossOrigin.push(request.url());
        }
    });
    await page.route(/^https:\/\/www\.youtube-nocookie\.com\//, route =>
        route.fulfill({ contentType: 'text/html', body: '<p>The player</p>' }));
    await page.goto('/projects/foundationDbFs');
    const play = page.getByRole('button', { name: /^Play video: / });
    await expect(play).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(crossOrigin).toEqual([]);
    await expect(page.locator('iframe')).toHaveCount(0);

    await play.click();

    const frame = page.locator('.writeup-video iframe');
    await expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/Q0pc37MOsxI?autoplay=1');
    await expect(page.frameLocator('.writeup-video iframe').locator('body')).toHaveText('The player');
    expect(crossOrigin).toEqual(['https://www.youtube-nocookie.com/embed/Q0pc37MOsxI?autoplay=1']);
});

// The Professional Work cards, in the backend's order, open their write-ups. Checks the pages'
// structure, not their copy, which lives in graphql-server's write-ups.
for (const [index, id] of ['broadAR', 'metaAvatars'].entries()) {
    test(`professional work card ${id} opens its write-up page`, async ({ page }) => {
        await page.goto('/projects');
        // The category's heading, in its row, in the category's block
        const category = page.getByRole('heading', { level: 2, name: 'Professional Work' }).locator('xpath=../../..');
        const cards = category.locator('.card');
        await expect(cards).toHaveCount(2);
        const card = cards.nth(index);
        const name = (await card.locator('.card-title').textContent())!;
        await card.getByRole('link', { name: 'View' }).click();

        await expect(page).toHaveURL(`/projects/${id}`);
        await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible();
        const hero = page.locator('.project-writeup img');
        await expect.poll(() => hero.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
        const articles = page.locator('.article-card a');
        await expect(articles.first()).toBeVisible();
        for (const link of await articles.all()) {
            await expect(link).toHaveAttribute('href', /^https:\/\//);
        }
        await expect(page.getByRole('link', { name: 'Back to Projects' })).toBeVisible();
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

    for (const path of ['/', '/projects', '/projects/sokoban', '/projects/seamCarver', '/projects/raytracer', '/projects/webglDemo', '/projects/zgal', '/projects/splats', '/projects/broadAR', '/projects/metaAvatars', '/projects/foundationDbFs']) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
    }

    expect(crossOrigin).toEqual([]);
});

// index.html's Content-Security-Policy: frames from the site and youtube-nocookie.com load, any
// other origin's are blocked. The allowed ones are answered locally, so the test stays offline.
test('frames may come only from the site and youtube-nocookie.com @firefox', async ({ page }) => {
    const framed: string[] = [];
    await page.route(/^https:\/\/(www\.youtube-nocookie\.com|www\.youtube\.com|example\.com)\//, route => {
        framed.push(route.request().url());
        return route.fulfill({ contentType: 'text/html', body: '<p>A frame</p>' });
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();

    await page.evaluate(() => {
        (window as any).blocked = [];
        document.addEventListener('securitypolicyviolation', event => {
            (window as any).blocked.push(`${event.effectiveDirective} ${new URL(event.blockedURI).origin}`);
        });
        for (const src of ['/robots.txt', 'https://www.youtube-nocookie.com/embed/Q0pc37MOsxI', 'https://www.youtube.com/embed/Q0pc37MOsxI', 'https://example.com/']) {
            const frame = document.createElement('iframe');
            frame.src = src;
            document.body.append(frame);
        }
    });

    await expect.poll(() => page.evaluate(() => [...(window as any).blocked].sort()))
        .toEqual(['frame-src https://example.com', 'frame-src https://www.youtube.com']);
    await expect.poll(() => framed).toEqual(['https://www.youtube-nocookie.com/embed/Q0pc37MOsxI']);
    // The site's own page loaded in its frame
    await expect(page.frameLocator('iframe[src="/robots.txt"]').locator('body')).toContainText('User-agent');
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
