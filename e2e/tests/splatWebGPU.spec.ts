import { readFileSync } from 'node:fs';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { collectErrors, colorCount } from './pageChecks';
import { WEBGPU_LAUNCH_OPTIONS } from './webgpu';

test.use({ launchOptions: WEBGPU_LAUNCH_OPTIONS });

const PAGE = '/projects/splats';
const SCENE_URL = '/assets/splat/scene.json';
const SCREENSHOT_URL = '/assets/splat/screenshot.webp';

// The lock's fixture (a small stream and its cameras), which ./build-splat puts beside the specs
const LOCK = JSON.parse(readFileSync(resolve(__dirname, '../../splat-scene.json'), 'utf8'));
const FIXTURE_DIR = resolve(__dirname, '../fixtures/splat');

// A black 1x1 PNG
const BLACK_PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==', 'base64');

interface SceneFile { path: string, bytes: number }
interface Scene { stream: SceneFile, cameras: SceneFile, bytes: number, splats: number, args: string[] }

// The page's scene description, as the backend serves it
async function realScene(page: Page): Promise<Scene> {
    return (await page.request.get(SCENE_URL)).json();
}

// What a StreamServer sent of its one response, and whether the browser closed it before the end
interface Sent { bytes: number, ended: boolean, aborted: boolean }

interface Pace {
    // Bytes written every intervalMs
    chunk: number,
    intervalMs: number,
    // Writing pauses once this many bytes are out, until release(): the page is then mid-stream for
    // as long as a test needs, however slowly the viewer starts
    holdAt?: number,
}

// Serves a body at a pace, as a slow connection would, to any origin. Unlike a route's response,
// which arrives whole, the page sees the bytes arrive, and the server sees whether the page stops
// reading (the browser then closes the connection). It serves one response: a second request (a
// remount, a retry) gets a 500, so that it fails loudly rather than mixing two streams' counts.
class StreamServer {
    readonly sent: Sent = { bytes: 0, ended: false, aborted: false };
    // Settles once writing has paused at pace.holdAt
    readonly held: Promise<void>;
    private readonly server: Server;
    private holding: boolean;
    private onHeld = () => {};

    constructor(body: Buffer, pace: Pace) {
        this.holding = pace.holdAt !== undefined;
        this.held = new Promise(resolve => this.onHeld = resolve);
        let served = false;
        this.server = createServer((_request, response) => {
            if (served) {
                response.writeHead(500).end('StreamServer serves one response');
                return;
            }
            served = true;
            response.writeHead(200, {
                'Content-Type': 'application/octet-stream',
                'Content-Length': body.length,
                'Access-Control-Allow-Origin': '*',
            });
            const timer = setInterval(() => {
                if (this.holding && this.sent.bytes >= pace.holdAt!) {
                    this.onHeld();
                    return;
                }
                const limit = this.holding ? pace.holdAt! : body.length;
                const end = Math.min(this.sent.bytes + pace.chunk, limit);
                response.write(body.subarray(this.sent.bytes, end));
                this.sent.bytes = end;
                if (end === body.length) {
                    clearInterval(timer);
                    response.end(() => this.sent.ended = true);
                }
            }, pace.intervalMs);
            response.on('close', () => {
                clearInterval(timer);
                this.sent.aborted = !this.sent.ended;
            });
        });
    }

    release() {
        this.holding = false;
    }

    async listen(): Promise<string> {
        await new Promise<void>(resolve => this.server.listen(0, '127.0.0.1', resolve));
        return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}/scene.stream`;
    }

    close() {
        this.server.closeAllConnections();
        this.server.close();
    }
}

let servers: StreamServer[] = [];
test.afterEach(() => {
    servers.forEach(server => server.close());
    servers = [];
});

// Serves the fixture in place of the scene, with a scene.json that describes it: its sizes (the
// progress bar's total), its splats, and a start camera it has (it holds fewer cameras than the
// scene). The stream comes from a StreamServer at the given pace (by default all at once), with
// patchStream's changes. The screenshot is a black pixel, so that a drawn canvas is told from the
// screenshot showing through it.
async function serveFixture(page: Page, options: { pace?: (streamBytes: number) => Pace, patchStream?(bytes: Buffer): void } = {}) {
    const scene = await realScene(page);
    const stream = readFileSync(resolve(FIXTURE_DIR, LOCK.fixture.stream.name));
    options.patchStream?.(stream);
    const cameras = readFileSync(resolve(FIXTURE_DIR, LOCK.fixture.cameras.name));
    const server = new StreamServer(stream, options.pace?.(stream.length) ?? { chunk: stream.length, intervalMs: 0 });
    servers.push(server);
    const streamUrl = await server.listen();

    const args = scene.args.map(arg => arg === scene.stream.path ? streamUrl : arg);
    args[args.indexOf('--camera') + 1] = '0';
    const fixtureScene = {
        ...scene,
        stream: { ...scene.stream, path: streamUrl, bytes: stream.length },
        cameras: { ...scene.cameras, bytes: cameras.length },
        bytes: stream.length + cameras.length,
        splats: LOCK.fixture.splats,
        args,
    };
    await page.route(SCENE_URL, route => route.fulfill({ json: fixtureScene }));
    await page.route(scene.cameras.path, route => route.fulfill({ body: cameras, contentType: 'application/octet-stream' }));
    await page.route(SCREENSHOT_URL, route => route.fulfill({ body: BLACK_PIXEL, contentType: 'image/png' }));
    // Past the fixture's route that answers other origins with an empty page
    await page.route(streamUrl, route => route.continue());
    return { scene: fixtureScene, sent: server.sent, server };
}

// Settles with the first of the viewer's messages that contains text (ZgalCanvas logs them), or
// fails, naming the text, after timeoutMs. Call it before the page loads, so that no message is missed.
function viewerMessage(page: Page, text: string, timeoutMs = 30_000): Promise<string> {
    const message = page.waitForEvent('console', { predicate: message => message.text().includes(text), timeout: timeoutMs })
        .then(message => message.text(), () => {
            throw new Error(`The viewer didn't log "${text}" within ${timeoutMs} ms`);
        });
    // Failing before a test awaits it isn't an unhandled rejection; the await still fails
    message.catch(() => {});
    return message;
}

// Settles once the canvas shows the same image twice in a row, half a second apart, and gives it
async function stillImage(page: Page): Promise<Buffer> {
    const canvas = page.locator('.splat-view canvas');
    let last = await canvas.screenshot();
    await expect.poll(async () => {
        const next = await canvas.screenshot();
        const same = next.equals(last);
        last = next;
        return same;
    }, { timeout: 30_000, intervals: [500] }).toBe(true);
    return last;
}

const progressBar = (page: Page) => page.getByRole('progressbar', { name: /^Loading the scene/ });

test('streams the scene in, draws it and moves with W', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    // Half the fixture, then nothing until released
    const { scene, sent, server } = await serveFixture(page, { pace: bytes => ({ chunk: 16_384, intervalMs: 20, holdAt: Math.floor(bytes / 2) }) });
    const accepted = viewerMessage(page, `splat_view: ${scene.splats} splats at SH degree`);
    await page.goto(PAGE);

    const view = page.locator('.splat-view');
    await expect(view).toHaveAttribute('data-zgal', 'running', { timeout: 30_000 });
    await accepted;
    // The bar shows what has arrived, out of the whole scene, until it all has
    await server.held;
    const progress = progressBar(page);
    await expect(progress).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => Number(await progress.getAttribute('aria-valuenow'))).toBeLessThan(100);
    server.release();
    await expect(progress).toHaveCount(0, { timeout: 30_000 });
    expect(sent).toEqual({ bytes: scene.stream.bytes, ended: true, aborted: false });

    // The viewer draws the scene
    const canvas = view.locator('canvas');
    await expect.poll(() => colorCount(page, canvas), { timeout: 30_000 }).toBeGreaterThan(100);

    // W, on the focused canvas, moves forward
    const before = await stillImage(page);
    await canvas.focus();
    await expect(canvas).toBeFocused();
    await page.keyboard.down('w');
    await expect.poll(async () => (await canvas.screenshot()).equals(before), { timeout: 30_000 }).toBe(false);
    await page.keyboard.up('w');

    await expect(view).toHaveAttribute('data-zgal', 'running');
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);
});

// A third of the fixture, then nothing: the page is mid-stream until it stops reading
const HELD = { pace: (bytes: number) => ({ chunk: 16_384, intervalMs: 20, holdAt: Math.floor(bytes / 3) }) };

// Leaving the page (the site's links load whole pages) ends the download
test('stops downloading the scene when the page is left', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    const { scene, sent, server } = await serveFixture(page, HELD);
    const accepted = viewerMessage(page, `splat_view: ${scene.splats} splats at SH degree`);
    await page.goto(PAGE);
    await accepted;
    await server.held;
    await expect(progressBar(page)).toBeVisible({ timeout: 30_000 });

    await page.getByRole('link', { name: 'Projects', exact: true }).click();
    await expect(page).toHaveURL('/projects');
    await expect.poll(() => sent.aborted, { timeout: 10_000 }).toBe(true);
    expect(sent.bytes).toBeLessThan(scene.stream.bytes);
    expect(errors).toEqual([]);
});

// The site's links load whole pages, which ends every download; an in-app route change (as a
// router link would make) unmounts the page instead, and its viewer's stop must cancel the download
test('stops downloading the scene when the app routes away from the page', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    const { scene, sent, server } = await serveFixture(page, HELD);
    const accepted = viewerMessage(page, `splat_view: ${scene.splats} splats at SH degree`);
    await page.goto(PAGE);
    await accepted;
    await server.held;
    await expect(progressBar(page)).toBeVisible({ timeout: 30_000 });

    await page.evaluate(() => {
        window.history.pushState({}, '', '/projects');
        window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(page.getByRole('heading', { name: 'Side Projects', exact: true })).toBeVisible();
    await expect(page.locator('.splat-view')).toHaveCount(0);
    await expect.poll(() => sent.aborted, { timeout: 10_000 }).toBe(true);
    expect(sent.bytes).toBeLessThan(scene.stream.bytes);
    expect(errors).toEqual([]);
});

test('says so when the stream isn\'t a scene', async ({ page }) => {
    test.setTimeout(60_000);
    // Another magic than "SPLS"
    await serveFixture(page, { patchStream: stream => stream.write('XXXX', 0, 'latin1') });
    const refused = viewerMessage(page, 'its stream header is one checkStreamHeader refuses');
    await page.goto(PAGE);

    await refused;
    await expect(page.getByRole('alert')).toContainText('The viewer couldn\'t run in this browser', { timeout: 30_000 });
    await expect(page.getByAltText('The viewer\'s start view (screenshot)')).toBeVisible();
    await expect(page.locator('.splat-view')).toHaveCount(0);
});

// The real scene, as the backend serves it: too large for SwiftShader to draw in time, but the
// viewer must accept its header (a stream whose format the viewer refuses fails here) and stream it
test('accepts the real scene\'s header and streams it', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    const scene = await realScene(page);
    const accepted = viewerMessage(page, `splat_view: ${scene.splats} splats at SH degree`, 30_000);
    await page.goto(PAGE);

    await expect(page.locator('.splat-view')).toHaveAttribute('data-zgal', 'running', { timeout: 20_000 });
    const progress = progressBar(page);
    // Bytes arrived: the bar shows them, or has gone with the whole scene
    await expect.poll(async () => await progress.count() === 0 || Number(await progress.getAttribute('aria-valuenow')) > 0,
        { timeout: 20_000 }).toBe(true);
    await accepted;
    await expect(page.locator('.splat-view')).toHaveAttribute('data-zgal', 'running');
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);
});
