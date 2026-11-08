import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from './fixtures';

// The sources the ZGAL page shows must be the ones at the commit the site pins external/zgal to,
// which ./build-zgal records in source.json; a build from a changed or other checkout fails here.

const REPO = resolve(__dirname, '../..');
const ASSETS = resolve(REPO, 'graphql-server/assets/zgal');

const git = (...args: string[]) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8' });

// The commit the site's own commit pins the submodule to (its gitlink), not whatever the
// submodule has checked out
const pinned = () => git('ls-tree', 'HEAD', 'external/zgal').split(/\s+/)[2];

// The program's source at the pinned commit, from the submodule's object store, so a change in its
// working tree doesn't hide a difference
const sourceAtPin = (name: string) => execFileSync('git', ['show', `${pinned()}:examples/${name}/${name}.zgal`],
    { cwd: resolve(REPO, 'external/zgal'), encoding: 'utf8' });

// Every program ./build-zgal copied, each served beside its source as <name>/<name>.zgal
const programs = (existsSync(ASSETS) ? readdirSync(ASSETS, { withFileTypes: true }) : [])
    .filter(entry => entry.isDirectory() && existsSync(resolve(ASSETS, entry.name, `${entry.name}.zgal`)))
    .map(entry => entry.name);

test('./build-zgal copied the programs\' sources', () => {
    expect(programs).toContain('particles');
});

test('source.json names the pinned commit of a clean checkout', async ({ request }) => {
    const response = await request.get('/assets/zgal/source.json');
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(await response.json()).toEqual({
        repository: 'https://github.com/zach-youssef/vulkan_testing',
        commit: pinned(),
        dirty: false,
    });
});

for (const name of programs) {
    test(`serves ${name}.zgal as text, as it is at the pinned commit`, async ({ request }) => {
        const response = await request.get(`/assets/zgal/${name}/${name}.zgal`);
        expect(response.ok()).toBe(true);
        expect(response.headers()['content-type']).toBe('text/plain; charset=utf-8');
        expect(await response.text()).toBe(sourceAtPin(name));
    });

    test(`the page lists ${name}.zgal as it is at the pinned commit, and links to it on GitHub there`, async ({ page, baseURL }) => {
        // Requests that leave the site, which the fixtures answer with an empty page
        const external: string[] = [];
        page.on('request', request => {
            if (new URL(request.url()).origin !== new URL(baseURL!).origin) {
                external.push(request.url());
            }
        });
        await page.goto(`/projects/zgal?sample=${name}`);

        // An unknown sample falls back to the default one, which would otherwise fail below as a
        // confusing difference in sources
        await expect(page.getByRole('heading', { name: `${name}.zgal`, level: 4 }),
            `${name} was copied by ./build-zgal but the page doesn't offer it: is it in SAMPLES?`).toBeVisible();

        // Exactly, not whitespace-normalized as toHaveText compares
        const listing = page.getByLabel(`${name}.zgal`, { exact: true });
        await expect.poll(() => listing.textContent()).toBe(sourceAtPin(name));
        const link = page.getByRole('link', { name: `View on GitHub at ${pinned().slice(0, 7)}`, exact: true });
        await expect(link).toHaveAttribute('href',
            `https://github.com/zach-youssef/vulkan_testing/blob/${pinned()}/examples/${name}/${name}.zgal`);
        await expect(page.getByText('local build')).toHaveCount(0);
        // The listing is the backend's copy; nothing is fetched from GitHub
        expect(external).toEqual([]);
    });
}
