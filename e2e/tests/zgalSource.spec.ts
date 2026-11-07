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
        // From the submodule's object store, so a change in its working tree doesn't hide a
        // difference
        const atPin = execFileSync('git', ['show', `${pinned()}:examples/${name}/${name}.zgal`],
            { cwd: resolve(REPO, 'external/zgal'), encoding: 'utf8' });
        expect(await response.text()).toBe(atPin);
    });
}
