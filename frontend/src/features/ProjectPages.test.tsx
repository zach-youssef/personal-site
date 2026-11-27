import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, RouteComponentProps } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import RaytracerPage from './raytracer/RaytracerPage';
import WebGLDemoPage from './webgl/WebGLDemoPage';
import PpuPage, { GITHUB_URL } from './ppu/PpuPage';
import ZgalPage, { GITHUB_URL as ZGAL_GITHUB_URL, SampleView } from './zgal/ZgalPage';
import { HeadlessSample, SAMPLES, WindowSample } from './zgal/samples';
import ImageFilterDemo, { DEFAULT_SETTINGS, filterCommandLine, RERUN_DELAY_MS } from './zgal/ImageFilterDemo';
import type { HeadlessOptions, ZgalHeadlessModule } from './zgal/zgalMount';
import { MANIFEST_URL, SourceManifest } from './zgal/SourceLink';
import { CameraMode, WebGLDemo } from './webgl/WebGLDemo';
import { sceneAssets } from './webgl/sceneAssets';
import { mockGraphQL } from '../testUtils/mockGraphQL';

describe('RaytracerPage', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('shows the rendered images from the server in a carousel', async () => {
        const images = [
            '/assets/raytracer/ConeAndCylinder.webp',
            '/assets/raytracer/ReflectionsAndShadows.webp',
        ];
        mockGraphQL({ raytracerImages: () => images });
        render(<RaytracerPage />);

        expect(screen.getByRole('heading', { name: 'Browser Raytracer' })).toBeInTheDocument();
        await waitFor(() => expect(screen.getAllByAltText('Demo').map(img => img.getAttribute('src'))).toEqual(images));
        // Only the first slide is shown at first, so the others wait to load
        expect(screen.getAllByAltText('Demo').map(img => img.getAttribute('loading'))).toEqual([null, 'lazy']);
    });

    it('fetches the image list only once', async () => {
        const server = mockGraphQL({ raytracerImages: () => ['/assets/raytracer/a.png'] });
        render(<RaytracerPage />);

        await screen.findByAltText('Demo');
        // Give any re-render triggered fetches a chance to happen
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(server.fetchMock).toHaveBeenCalledTimes(1);
    });
});

describe('WebGLDemoPage', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    function fakeDemo() {
        const demo = {
            loaded: Promise.resolve(),
            setCameraMode: vi.fn(),
            setDrawPath: vi.fn(),
            dispose: vi.fn(),
        };
        const create = vi.spyOn(WebGLDemo, 'create').mockReturnValue(demo as unknown as WebGLDemo);
        return { demo, create };
    }

    it('draws the demo into its canvas', () => {
        const { create } = fakeDemo();
        render(<WebGLDemoPage />);

        expect(create).toHaveBeenCalledTimes(1);
        expect(create.mock.calls[0][0]).toBe(screen.getByLabelText('WebGL Demo'));
        expect(create.mock.calls[0][1]).toBe(sceneAssets);
    });

    it('shows the frame rate the demo measures', () => {
        const { create } = fakeDemo();
        render(<WebGLDemoPage />);

        act(() => create.mock.calls[0][2](59.94));

        expect(screen.getByText('Frame rate: 59.9')).toBeInTheDocument();
    });

    function pressed(name: string): boolean {
        return screen.getByRole('button', { name }).getAttribute('aria-pressed') === 'true';
    }

    it('starts from the front with the plane path hidden', () => {
        const { demo } = fakeDemo();
        render(<WebGLDemoPage />);

        expect(pressed('Front')).toBe(true);
        expect(pressed('Top')).toBe(false);
        expect(screen.getByRole('switch', { name: 'Plane Path' })).not.toBeChecked();
        expect(demo.setCameraMode).toHaveBeenLastCalledWith(CameraMode.Front);
        expect(demo.setDrawPath).toHaveBeenLastCalledWith(false);
    });

    it('passes the controls on to the demo and shows which are on', async () => {
        const { demo } = fakeDemo();
        render(<WebGLDemoPage />);

        await userEvent.click(screen.getByRole('button', { name: 'Top' }));
        expect(demo.setCameraMode).toHaveBeenLastCalledWith(CameraMode.Top);
        expect(pressed('Top')).toBe(true);
        expect(pressed('Front')).toBe(false);
        expect(screen.getByRole('button', { name: 'Top' })).toHaveClass('btn-primary');
        expect(screen.getByRole('button', { name: 'Front' })).toHaveClass('btn-secondary');

        const planePath = screen.getByRole('switch', { name: 'Plane Path' });
        await userEvent.click(planePath);
        expect(demo.setDrawPath).toHaveBeenLastCalledWith(true);
        expect(planePath).toBeChecked();
        await userEvent.click(planePath);
        expect(demo.setDrawPath).toHaveBeenLastCalledWith(false);
        expect(planePath).not.toBeChecked();
    });

    it('has keyboard shortcuts for the buttons', async () => {
        const { demo } = fakeDemo();
        render(<WebGLDemoPage />);

        await userEvent.keyboard('p');
        expect(demo.setCameraMode).toHaveBeenLastCalledWith(CameraMode.Ground);
        expect(pressed('Ground')).toBe(true);
        await userEvent.keyboard('s');
        expect(screen.getByRole('switch', { name: 'Plane Path' })).toBeChecked();
        // Browser shortcuts like Ctrl+F are left alone
        await userEvent.keyboard('{Control>}f{/Control}');
        expect(pressed('Ground')).toBe(true);
    });

    it('stops the demo when the page is left', () => {
        const { demo } = fakeDemo();
        const { unmount } = render(<WebGLDemoPage />);

        expect(demo.dispose).not.toHaveBeenCalled();
        unmount();
        expect(demo.dispose).toHaveBeenCalledTimes(1);
    });

    // StrictMode mounts the page, unmounts it and mounts it again in development. dispose() loses
    // the canvas's WebGL context for good, so the second mount must draw into another canvas
    it('draws into a new canvas when mounted again, as StrictMode does', () => {
        const demos: { dispose: Mock }[] = [];
        const create = vi.spyOn(WebGLDemo, 'create').mockImplementation(() => {
            const demo = { loaded: Promise.resolve(), setCameraMode: vi.fn(), setDrawPath: vi.fn(), dispose: vi.fn() };
            demos.push(demo);
            return demo as unknown as WebGLDemo;
        });
        render(<React.StrictMode><WebGLDemoPage /></React.StrictMode>);

        expect(create).toHaveBeenCalledTimes(2);
        const [first, second] = create.mock.calls.map(([canvas]) => canvas);
        expect(second).not.toBe(first);
        expect(demos[0].dispose).toHaveBeenCalledTimes(1);
        expect(demos[1].dispose).not.toHaveBeenCalled();
        // The page shows the live demo's canvas, and only that one
        expect(screen.getAllByLabelText('WebGL Demo')).toEqual([second]);
    });

    it('keeps one canvas under StrictMode when the browser has no WebGL', () => {
        vi.spyOn(WebGLDemo, 'create').mockReturnValue(null);
        render(<React.StrictMode><WebGLDemoPage /></React.StrictMode>);

        expect(screen.getAllByLabelText('WebGL Demo')).toHaveLength(1);
    });

    it('says so when the browser has no WebGL', () => {
        vi.spyOn(WebGLDemo, 'create').mockReturnValue(null);
        render(<WebGLDemoPage />);

        expect(screen.getByRole('alert')).toHaveTextContent('This demo needs a browser that supports WebGL.');
    });

    it('says so when the scene fails to load', async () => {
        const { demo } = fakeDemo();
        demo.loaded = Promise.reject(new Error('404'));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        render(<WebGLDemoPage />);

        expect(await screen.findByRole('alert')).toHaveTextContent("The scene couldn't be loaded.");
    });
});

describe('sceneAssets', () => {
    it('serves every file the scene names', () => {
        const scene = JSON.parse(readFileSync(resolve(__dirname, 'webgl/assets/hogwarts.json'), 'utf-8'));
        const paths: string[] = [...scene.instances, ...scene.images].map(file => file.path);

        expect(paths.length).toBeGreaterThan(0);
        for (const path of paths) {
            expect(sceneAssets.resolve(path)).toMatch(/\S/);
        }
    });

    it('rejects files the scene would need but are missing', () => {
        expect(() => sceneAssets.resolve('models/missing.obj')).toThrow('models/missing.obj');
    });
});

// jsdom has no WebGPU; the ZGAL pages' tests give the page a navigator.gpu when they need one
function setWebGPU(available: boolean) {
    if (available) {
        Object.defineProperty(navigator, 'gpu', { configurable: true, value: {} });
    } else {
        delete (navigator as { gpu?: unknown }).gpu;
    }
}

describe('PpuPage', () => {
    afterEach(() => {
        setWebGPU(false);
    });

    it('links to the project on GitHub', () => {
        render(<PpuPage />);

        expect(screen.getByRole('heading', { name: 'Vulkan Retro PPU' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'View on GitHub' })).toHaveAttribute('href', GITHUB_URL);
    });

    it('runs each game in a frame of its generated page', () => {
        setWebGPU(true);
        render(<PpuPage />);

        expect(screen.getByTitle('Super Mario Bros. 3')).toHaveAttribute('src', '/assets/ppu/smb3/smb3.zgal.html');
        expect(screen.getByTitle('Batman')).toHaveAttribute('src', '/assets/ppu/batman/batman.zgal.html');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows a frame from each game when the browser has no WebGPU', () => {
        setWebGPU(false);
        const { container } = render(<PpuPage />);

        expect(screen.getByRole('alert')).toHaveTextContent('These games need a browser that supports WebGPU');
        expect(container.querySelector('iframe')).toBeNull();
        expect(screen.getByAltText('Super Mario Bros. 3')).toHaveAttribute('src', '/assets/ppu/smb3/screenshot.png');
        expect(screen.getByAltText('Batman')).toHaveAttribute('src', '/assets/ppu/batman/screenshot.png');
    });

    it('says so when a game fails to run', async () => {
        setWebGPU(true);
        render(<PpuPage />);
        // jsdom doesn't load the game's page, so the frame gets a document standing in for it
        const frame = screen.getByTitle('Batman');
        const gameDocument = document.implementation.createHTMLDocument();
        Object.defineProperty(frame, 'contentDocument', { value: gameDocument });

        act(() => {
            frame.dispatchEvent(new Event('load'));
        });
        gameDocument.documentElement.dataset.zgal = 'running';
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        gameDocument.documentElement.dataset.zgal = 'failed';

        expect(await screen.findByRole('alert')).toHaveTextContent("Batman couldn't run in this browser.");
        // The games keep the runner's whole-multiple scaling, so their pixels stay square
        expect(gameDocument.head.querySelector('style')).toBeNull();
    });
});

describe('ZgalPage', () => {
    const SOURCE = ';; GPU particles\n(graph ParticlesGraph)\n';
    const PARTICLES = SAMPLES.find(sample => sample.id === 'particles')!;
    const SCENE = SAMPLES.find(sample => sample.id === 'scene')!;
    const RAYMARCH = SAMPLES.find(sample => sample.id === 'raymarch')!;

    const COMMIT = '13ffa592b47374862b93d7f5d4c4a9565b64c0af';
    const MANIFEST: SourceManifest = { repository: 'https://github.com/zach-youssef/zgal', commit: COMMIT, dirty: false };
    const serveManifest = (manifest: unknown): Partial<Response> => ({ ok: true, json: async () => manifest });

    // Serves every program's source as the given response, and source.json as the other
    function serveSource(response: Partial<Response>, manifest: Partial<Response> = serveManifest(MANIFEST)) {
        const fetchMock = vi.fn(async (url: string) => (url === MANIFEST_URL ? manifest : response) as Response);
        vi.stubGlobal('fetch', fetchMock);
        return fetchMock;
    }

    const fetchesOf = (fetchMock: ReturnType<typeof serveSource>, url: string) =>
        fetchMock.mock.calls.filter(([fetched]) => fetched === url).length;

    // Renders the page at /projects/zgal with the given query, and keeps the router's location
    function renderPage(search = '') {
        const current: { location?: RouteComponentProps['location'] } = {};
        const result = render(
            <MemoryRouter initialEntries={[`/projects/zgal${search}`]}>
                <ZgalPage />
                <Route render={({ location }) => {
                    current.location = location;
                    return null;
                }} />
            </MemoryRouter>,
        );
        return { ...result, current };
    }

    function selector() {
        return within(screen.getByRole('group', { name: 'Example' }));
    }

    function selected(): string[] {
        return selector().getAllByRole('button')
            .filter(button => button.getAttribute('aria-pressed') === 'true')
            .map(button => button.textContent!);
    }

    // jsdom doesn't load the program's page, so the frame gets a document standing in for it
    function loadFrame(title: string): Document {
        const frame = screen.getByTitle(title);
        const programDocument = document.implementation.createHTMLDocument();
        Object.defineProperty(frame, 'contentDocument', { value: programDocument });
        act(() => {
            frame.dispatchEvent(new Event('load'));
        });
        return programDocument;
    }

    // The page loads the shown sample's source and the source manifest as it opens: waits until it
    // shows both, so their updates land within the test
    async function loaded(file: string) {
        await waitFor(() => {
            expect(screen.getByLabelText(file).textContent).toBe(SOURCE);
            expect(screen.getByRole('link', { name: /^View on GitHub at / })).toBeInTheDocument();
        });
    }

    afterEach(() => {
        setWebGPU(false);
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('links to the project on GitHub', async () => {
        serveSource({ ok: true, text: async () => SOURCE });
        renderPage();

        expect(screen.getByRole('heading', { name: 'ZGAL', level: 2 })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'View on GitHub' })).toHaveAttribute('href', ZGAL_GITHUB_URL);
        await loaded('particles.zgal');
    });

    it('offers particles, scene, raymarch and the image filter, and selects particles by default', async () => {
        setWebGPU(true);
        serveSource({ ok: true, text: async () => SOURCE });
        renderPage();

        expect(selector().getAllByRole('button').map(button => button.textContent)).toEqual(['Particles', 'Scene', 'Raymarch', 'Image filter']);
        expect(selected()).toEqual(['Particles']);
        // The theme's colours: primary for the selected sample, secondary for the others
        expect(selector().getByRole('button', { name: 'Particles' })).toHaveClass('btn-primary');
        expect(selector().getByRole('button', { name: 'Scene' })).toHaveClass('btn-secondary');
        expect(screen.getByTitle('Particles')).toBeInTheDocument();
        expect(screen.queryByTitle('Scene')).not.toBeInTheDocument();
        expect(screen.getByText(PARTICLES.blurb)).toBeInTheDocument();
        await loaded('particles.zgal');
    });

    it.each([['?sample=missing'], ['?sample='], ['?sample=Scene'], ['?other=scene']])(
        'selects particles when the URL names no sample it has (%s)', async search => {
            setWebGPU(true);
            serveSource({ ok: true, text: async () => SOURCE });
            renderPage(search);

            expect(selected()).toEqual(['Particles']);
            expect(screen.getByTitle('Particles')).toHaveAttribute('src', '/assets/zgal/particles/particles.zgal.html');
            await loaded('particles.zgal');
        });

    it('opens on the sample a link names', async () => {
        setWebGPU(true);
        const fetchMock = serveSource({ ok: true, text: async () => SOURCE });
        renderPage('?sample=scene');

        expect(selected()).toEqual(['Scene']);
        expect(screen.getByTitle('Scene')).toHaveAttribute('src', '/assets/zgal/scene/scene.zgal.html');
        expect(screen.queryByTitle('Particles')).not.toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith('/assets/zgal/scene/scene.zgal', { cache: 'no-cache' });
        expect(fetchMock).not.toHaveBeenCalledWith('/assets/zgal/particles/particles.zgal', expect.anything());
        // Revalidated, so the listing and the link can't come from different deploys
        expect(fetchMock).toHaveBeenCalledWith(MANIFEST_URL, { cache: 'no-cache' });
        expect(screen.getByText(SCENE.blurb)).toBeInTheDocument();
        await waitFor(() => expect(screen.getByLabelText('scene.zgal').textContent).toBe(SOURCE));
    });

    it('switches samples from the selector and records the choice in the URL', async () => {
        setWebGPU(true);
        serveSource({ ok: true, text: async () => SOURCE });
        const { current } = renderPage('?from=home');

        await userEvent.click(selector().getByRole('button', { name: 'Scene' }));
        expect(current.location!.search).toBe('?from=home&sample=scene');
        expect(selected()).toEqual(['Scene']);
        expect(screen.getByTitle('Scene')).toHaveAttribute('src', '/assets/zgal/scene/scene.zgal.html');
        expect(selector().getByRole('button', { name: 'Scene' })).toHaveClass('btn-primary');
        expect(selector().getByRole('button', { name: 'Particles' })).toHaveClass('btn-secondary');

        await userEvent.click(selector().getByRole('button', { name: 'Particles' }));
        expect(current.location!.search).toBe('?from=home&sample=particles');
        expect(screen.getByTitle('Particles')).toBeInTheDocument();
        expect(screen.queryByTitle('Scene')).not.toBeInTheDocument();

        // And to raymarch, with its own source and blurb
        await userEvent.click(selector().getByRole('button', { name: 'Raymarch' }));
        expect(current.location!.search).toBe('?from=home&sample=raymarch');
        expect(selected()).toEqual(['Raymarch']);
        expect(screen.getByTitle('Raymarch')).toHaveAttribute('src', '/assets/zgal/raymarch/raymarch.zgal.html');
        expect(screen.queryByTitle('Particles')).not.toBeInTheDocument();
        expect(screen.getByText(RAYMARCH.blurb)).toBeInTheDocument();
        await waitFor(() => expect(screen.getByLabelText('raymarch.zgal').textContent).toBe(SOURCE));
    });

    it('restarts the selected sample when it is chosen again', async () => {
        setWebGPU(true);
        const fetchMock = serveSource({ ok: true, text: async () => SOURCE });
        const { current } = renderPage('?sample=scene');
        const first = screen.getByTitle('Scene');
        await waitFor(() => expect(screen.getByLabelText('scene.zgal').textContent).toBe(SOURCE));

        // The running sample's button says choosing it restarts; the others don't
        expect(selector().getByRole('button', { name: 'Scene' })).toHaveAttribute('title', 'Restart');
        expect(selector().getByRole('button', { name: 'Particles' })).not.toHaveAttribute('title');
        await userEvent.click(selector().getByRole('button', { name: 'Scene' }));

        // A new frame, which loads the program again; the source stays as it was
        expect(screen.getByTitle('Scene')).not.toBe(first);
        expect(screen.getByTitle('Scene')).toHaveAttribute('src', '/assets/zgal/scene/scene.zgal.html');
        expect(current.location!.search).toBe('?sample=scene');
        expect(fetchesOf(fetchMock, '/assets/zgal/scene/scene.zgal')).toBe(1);
        expect(fetchesOf(fetchMock, MANIFEST_URL)).toBe(1);
    });

    it('does not offer a restart without WebGPU', async () => {
        setWebGPU(false);
        serveSource({ ok: true, text: async () => SOURCE });
        renderPage('?sample=scene');

        expect(screen.queryByText(/restart/i)).toBeNull();
        expect(selector().getByRole('button', { name: 'Scene' })).not.toHaveAttribute('title');
        await loaded('scene.zgal');
    });

    it("lists each sample's controls from its main", async () => {
        serveSource({ ok: true, text: async () => SOURCE });
        renderPage('?sample=scene');

        const terms = [...document.querySelectorAll('dt')].map(term => term.textContent);
        const actions = [...document.querySelectorAll('dd')].map(action => action.textContent);
        expect(terms).toEqual(['Drag', 'Scroll', 'L', 'S', '+ / -', 'Esc']);
        expect(actions[terms.indexOf('Esc')]).toBe('stops the program');
        await loaded('scene.zgal');
    });

    it("lists raymarch's controls from its main", async () => {
        serveSource({ ok: true, text: async () => SOURCE });
        renderPage('?sample=raymarch');

        const terms = [...document.querySelectorAll('dt')].map(term => term.textContent);
        expect(terms).toEqual(['Drag', 'Scroll', 'T', 'Space', 'Esc']);
        await loaded('raymarch.zgal');
    });

    // The samples with a window, which run in frames of their pages
    const WINDOWED = SAMPLES.filter((sample): sample is WindowSample => sample.kind === 'program');

    it('runs every sample but the image filter in a frame', () => {
        expect(WINDOWED.map(sample => sample.id)).toEqual(['particles', 'scene', 'raymarch']);
    });

    describe.each(WINDOWED.map(sample => [sample.id, sample] as const))('the %s sample', (id, sample) => {
        it('runs in a frame of its generated page beside its source', async () => {
            setWebGPU(true);
            const fetchMock = serveSource({ ok: true, text: async () => SOURCE });
            renderPage(`?sample=${id}`);

            expect(screen.getByTitle(sample.title)).toHaveAttribute('src', `/assets/zgal/${id}/${id}.zgal.html`);
            expect(fetchMock).toHaveBeenCalledWith(`/assets/zgal/${id}/${id}.zgal`, { cache: 'no-cache' });
            await waitFor(() => expect(screen.getByLabelText(`${id}.zgal`).textContent).toBe(SOURCE));
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it("keeps its window's aspect ratio and scales to its frame", async () => {
            setWebGPU(true);
            serveSource({ ok: true, text: async () => SOURCE });
            renderPage(`?sample=${id}`);

            expect(screen.getByTitle(sample.title).style.aspectRatio).toBe(`${sample.width} / ${sample.height}`);
            // Over the runner's inline size, centring offset and pixelated rendering
            const fit = loadFrame(sample.title).head.querySelector('style')?.textContent;
            expect(fit).toMatch(/^canvas#zgal \{/);
            for (const declaration of ['left: 0 !important', 'top: 0 !important', 'width: 100% !important',
                'height: 100% !important', 'object-fit: contain', 'image-rendering: auto !important']) {
                expect(fit).toContain(declaration);
            }
            await loaded(`${id}.zgal`);
        });

        it('shows a frame from it when the browser has no WebGPU', async () => {
            setWebGPU(false);
            serveSource({ ok: true, text: async () => SOURCE });
            const { container } = renderPage(`?sample=${id}`);

            expect(screen.getByRole('alert')).toHaveTextContent('This program needs a browser that supports WebGPU');
            expect(container.querySelector('iframe')).toBeNull();
            expect(screen.getByAltText(sample.title)).toHaveAttribute('src', `/assets/zgal/${id}/screenshot.webp`);
            await loaded(`${id}.zgal`);
        });

        it('says so when it fails to run', async () => {
            setWebGPU(true);
            serveSource({ ok: true, text: async () => SOURCE });
            renderPage(`?sample=${id}`);
            const programDocument = loadFrame(sample.title);

            programDocument.documentElement.dataset.zgal = 'running';
            await loaded(`${id}.zgal`);
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
            programDocument.documentElement.dataset.zgal = 'failed';

            expect(await screen.findByRole('alert')).toHaveTextContent(`${sample.title} couldn't run in this browser.`);
        });
    });

    it("links each sample's listing to its source on GitHub at the commit it was copied from", async () => {
        setWebGPU(true);
        const fetchMock = serveSource({ ok: true, text: async () => SOURCE });
        renderPage();

        const link = await screen.findByRole('link', { name: 'View on GitHub at 13ffa59' });
        expect(link).toHaveAttribute('href',
            `https://github.com/zach-youssef/zgal/blob/${COMMIT}/examples/particles/particles.zgal`);
        expect(link).toHaveAttribute('title', COMMIT);
        // The listing still comes from the backend's copy, not GitHub
        await waitFor(() => expect(screen.getByLabelText('particles.zgal').textContent).toBe(SOURCE));
        expect(fetchMock.mock.calls.map(([url]) => url).filter(url => !url.startsWith('/'))).toEqual([]);

        await userEvent.click(selector().getByRole('button', { name: 'Scene' }));

        expect(screen.getByRole('link', { name: 'View on GitHub at 13ffa59' })).toHaveAttribute('href',
            `https://github.com/zach-youssef/zgal/blob/${COMMIT}/examples/scene/scene.zgal`);
        // Loaded once for the page, not again for each sample
        expect(fetchesOf(fetchMock, MANIFEST_URL)).toBe(1);
    });

    it('says the sources are a local build, without a link, when GitHub may not have their commit', async () => {
        serveSource({ ok: true, text: async () => SOURCE }, serveManifest({ ...MANIFEST, dirty: true }));
        renderPage();

        expect(await screen.findByText('local build')).toHaveClass('text-muted');
        expect(screen.queryByRole('link', { name: /View on GitHub at/ })).not.toBeInTheDocument();
        await waitFor(() => expect(screen.getByLabelText('particles.zgal').textContent).toBe(SOURCE));
    });

    it.each([
        ['is missing', { ok: false, status: 404 }],
        ['is not JSON', { ok: true, json: async () => { throw new SyntaxError('Unexpected token'); } }],
        ['has no commit', serveManifest({ repository: MANIFEST.repository, dirty: false })],
        ['names something else than a commit', serveManifest({ ...MANIFEST, commit: '../../evil' })],
        ['names a repository that is not a web URL', serveManifest({ ...MANIFEST, repository: 'javascript:alert(1)' })],
    ] as [string, Partial<Response>][])('lists the source without a link when the manifest %s', async (_, manifest) => {
        setWebGPU(true);
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        serveSource({ ok: true, text: async () => SOURCE }, manifest);
        renderPage();

        await waitFor(() => expect(screen.getByLabelText('particles.zgal').textContent).toBe(SOURCE));
        await waitFor(() => expect(error).toHaveBeenCalled());
        expect(screen.queryByRole('link', { name: /View on GitHub at/ })).not.toBeInTheDocument();
        expect(screen.queryByText('local build')).not.toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('says so when the source fails to load', async () => {
        setWebGPU(true);
        serveSource({ ok: false, status: 404 });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        renderPage();

        expect(await screen.findByRole('alert')).toHaveTextContent("The program's source couldn't be loaded.");
    });

    it("starts another sample afresh after the last one's source and frame failed", async () => {
        setWebGPU(true);
        vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.endsWith('particles.zgal')
            ? { ok: false, status: 404 } as Response
            : { ok: true, text: async () => SOURCE } as Response)));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        renderPage();
        loadFrame('Particles').documentElement.dataset.zgal = 'failed';
        await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));

        // Clicked synchronously, to see the listing before the scene's source arrives
        act(() => selector().getByRole('button', { name: 'Scene' }).click());

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByLabelText('scene.zgal').textContent).toBe('Loading…');
        expect(screen.getByTitle('Scene')).toHaveAttribute('src', '/assets/zgal/scene/scene.zgal.html');
        await waitFor(() => expect(screen.getByLabelText('scene.zgal').textContent).toBe(SOURCE));
    });

    it("doesn't list the last sample's source when it arrives after another sample's", async () => {
        let serveParticles: (text: string) => void = () => {};
        vi.stubGlobal('fetch', vi.fn((url: string) => (url.endsWith('particles.zgal')
            ? new Promise<Response>(resolve => {
                serveParticles = text => resolve({ ok: true, text: async () => text } as Response);
            })
            : Promise.resolve({ ok: true, text: async () => SOURCE } as Response))));
        const { rerender } = render(<SampleView sample={PARTICLES} webGPU={false} manifest={MANIFEST} />);

        rerender(<SampleView sample={SCENE} webGPU={false} manifest={MANIFEST} />);
        await waitFor(() => expect(screen.getByLabelText('scene.zgal').textContent).toBe(SOURCE));
        await act(async () => {
            serveParticles(';; particles\n');
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        expect(screen.getByLabelText('scene.zgal').textContent).toBe(SOURCE);
    });
});

describe('ImageFilterDemo', () => {
    const FILTER = SAMPLES.find((sample): sample is HeadlessSample => sample.kind === 'headless')!;

    // A run of the fake program: its options, and ways to make it report as the runtime would
    interface FakeRun {
        options: HeadlessOptions,
        stop: Mock<() => Promise<void>>,
        // Settles done with the state it ended in
        end(state: 'stopped' | 'failed'): void,
        // Reports running, captures a PNG, and ends stopped
        succeed(): Promise<Blob>,
    }

    // A main whose runHeadless records each run, whose stop settles once release() is called when
    // holdStops is set
    function fakeProgram({ holdStops = false } = {}) {
        const runs: FakeRun[] = [];
        let held = holdStops;
        let releases: (() => void)[] = [];
        const module: ZgalHeadlessModule = {
            runHeadless: vi.fn((options: HeadlessOptions) => {
                let settle: (state: 'stopped' | 'failed') => void = () => {};
                const done = new Promise<'stopped' | 'failed'>(resolve => {
                    settle = resolve;
                });
                const run: FakeRun = {
                    options,
                    stop: vi.fn(() => {
                        settle('stopped');
                        return held ? new Promise<void>(resolve => releases.push(resolve)) : Promise.resolve();
                    }),
                    end: settle,
                    succeed: async () => {
                        const png = new Blob(['png'], { type: 'image/png' });
                        await act(async () => {
                            options.onState?.('running');
                            options.onCapture?.({ path: 'image_filter.png', frame: null, size: [2, 2], rgba: new Uint8Array(16), png });
                            options.onState?.('stopped');
                            settle('stopped');
                        });
                        return png;
                    },
                };
                runs.push(run);
                return { done, stop: run.stop };
            }),
        };
        const release = () => {
            releases.forEach(resolve => resolve());
            releases = [];
        };
        // The test's end: stops that come after it (an unmount's) don't wait either
        fakes.push(() => {
            held = false;
            release();
        });
        return { runs, release, load: vi.fn(async () => module) };
    }

    // Every fake's release: the runs' stops are awaited by every later run, in any test
    const fakes: (() => void)[] = [];

    beforeEach(() => {
        // jsdom has no object URLs
        let next = 0;
        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => `blob:fake/${next++}`) });
        Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    });

    afterEach(() => {
        // Unmounted first, as it revokes its URLs: the global cleanup runs after this
        cleanup();
        fakes.splice(0).forEach(release => release());
        delete (URL as { createObjectURL?: unknown }).createObjectURL;
        delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('turns its settings into image_filter\'s command line', () => {
        expect(filterCommandLine(DEFAULT_SETTINGS)).toEqual({ args: ['input.png', 'image_filter.png', '--blur', '2', '--edges'], files: {} });
        const file = new File(['x'], 'photo.jpg');
        expect(filterCommandLine({ file, blur: false, radius: 9, edges: false, threshold: true, level: 0.25 }))
            .toEqual({ args: ['photo.jpg', 'image_filter.png', '--threshold', '0.25'], files: { 'photo.jpg': file } });
        // A name that would read as an option
        const dashed = new File(['x'], '--help.png');
        expect(filterCommandLine({ ...DEFAULT_SETTINGS, file: dashed }).files).toEqual({ './--help.png': dashed });
    });

    it('filters the example picture with --blur 2 --edges from its main, and offers the PNG to download', async () => {
        const { runs, load } = fakeProgram();
        const { container } = render(<ImageFilterDemo sample={FILTER} webGPU load={load} />);

        await waitFor(() => expect(runs).toHaveLength(1));
        expect(load).toHaveBeenCalledWith('/assets/zgal/image_filter/image_filter.zgal.main.js');
        expect(runs[0].options.args).toEqual(['input.png', 'image_filter.png', '--blur', '2', '--edges']);
        expect(screen.getByText('Filtering…')).toBeInTheDocument();
        expect(screen.getByAltText('Image filter input')).toHaveAttribute('src', '/assets/zgal/image_filter/assets/input.png');
        const png = await runs[0].succeed();

        expect(container.firstElementChild).toHaveAttribute('data-zgal', 'stopped');
        const output = screen.getByAltText('Image filter output');
        expect(URL.createObjectURL).toHaveBeenCalledWith(png);
        const link = screen.getByRole('link', { name: 'Download' });
        expect(link).toHaveAttribute('download', 'image_filter.png');
        expect(link).toHaveAttribute('href', output.getAttribute('src'));
        expect(screen.queryByText('Filtering…')).not.toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        // Its options as switches, the values' sliders in the program's ranges
        expect(screen.getByRole('switch', { name: 'Blur' })).toBeChecked();
        expect(screen.getByRole('switch', { name: 'Edges' })).toBeChecked();
        expect(screen.getByRole('switch', { name: 'Threshold' })).not.toBeChecked();
        expect(screen.getByLabelText('Blur radius')).toHaveAttribute('min', '1');
        expect(screen.getByLabelText('Blur radius')).toHaveAttribute('max', '64');
        expect(screen.getByLabelText('Threshold level')).toBeDisabled();
    });

    it('stops the last run before filtering again when a switch changes', async () => {
        const { runs, release, load } = fakeProgram({ holdStops: true });
        render(<ImageFilterDemo sample={FILTER} webGPU load={load} />);
        await waitFor(() => expect(runs).toHaveLength(1));
        await runs[0].succeed();

        await userEvent.click(screen.getByRole('switch', { name: 'Edges' }));
        await userEvent.click(screen.getByRole('switch', { name: 'Threshold' }));
        // The last output fades, without its link, until the next arrives
        expect(screen.getByAltText('Image filter output').closest('figure')).toHaveClass('stale');
        expect(screen.queryByRole('link', { name: 'Download' })).not.toBeInTheDocument();

        // Each change stops the run before it; none starts until the stops have finished
        expect(runs[0].stop).toHaveBeenCalled();
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(runs).toHaveLength(1);
        act(() => release());
        await waitFor(() => expect(runs).toHaveLength(2));
        // Only the last settings run: the change between was stopped before it started
        expect(runs[1].options.args).toEqual(['input.png', 'image_filter.png', '--blur', '2', '--threshold', '0.15']);
        // The last output stays until the next arrives
        expect(screen.getByAltText('Image filter output')).toBeInTheDocument();
        await runs[1].succeed();
        expect(URL.revokeObjectURL).toHaveBeenCalled();
        expect(screen.getByAltText('Image filter output').closest('figure')).not.toHaveClass('stale');
        expect(screen.getByRole('link', { name: 'Download' })).toBeInTheDocument();
    });

    it('starts no run until the runs of an instance before it have stopped', async () => {
        const { runs, release, load } = fakeProgram({ holdStops: true });
        const { unmount } = render(<ImageFilterDemo sample={FILTER} webGPU load={load} />);
        await waitFor(() => expect(runs).toHaveLength(1));
        unmount();

        // As when another sample is chosen and this one again
        render(<ImageFilterDemo sample={FILTER} webGPU load={load} />);
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(runs[0].stop).toHaveBeenCalled();
        expect(runs).toHaveLength(1);
        act(() => release());
        await waitFor(() => expect(runs).toHaveLength(2));
    });

    it('disables a value\'s slider while its option is off', async () => {
        const { runs, load } = fakeProgram();
        render(<ImageFilterDemo sample={FILTER} webGPU load={load} />);
        await waitFor(() => expect(runs).toHaveLength(1));
        expect(screen.getByLabelText('Blur radius')).toBeEnabled();
        expect(screen.getByLabelText('Threshold level')).toBeDisabled();

        await userEvent.click(screen.getByRole('switch', { name: 'Blur' }));
        await userEvent.click(screen.getByRole('switch', { name: 'Threshold' }));

        expect(screen.getByLabelText('Blur radius')).toBeDisabled();
        expect(screen.getByLabelText('Threshold level')).toBeEnabled();
        await waitFor(() => expect(runs.at(-1)!.options.args).toEqual(['input.png', 'image_filter.png', '--edges', '--threshold', '0.15']));
    });

    it('filters again once a slider has stopped moving, not at every step', async () => {
        const { runs, load } = fakeProgram();
        render(<ImageFilterDemo sample={FILTER} webGPU load={load} />);
        await waitFor(() => expect(runs).toHaveLength(1));
        await runs[0].succeed();

        const radius = screen.getByLabelText('Blur radius');
        for (const value of ['3', '4', '5']) {
            fireChange(radius, value);
        }
        expect(screen.getByText('5 px')).toBeInTheDocument();
        await new Promise(resolve => setTimeout(resolve, RERUN_DELAY_MS / 2));
        expect(runs).toHaveLength(1);

        await waitFor(() => expect(runs).toHaveLength(2));
        expect(runs[1].options.args).toEqual(['input.png', 'image_filter.png', '--blur', '5', '--edges']);
        await new Promise(resolve => setTimeout(resolve, RERUN_DELAY_MS));
        expect(runs).toHaveLength(2);
    });

    it('filters a picture the visitor chooses, and goes back to the example', async () => {
        const { runs, load } = fakeProgram();
        render(<ImageFilterDemo sample={FILTER} webGPU load={load} />);
        await waitFor(() => expect(runs).toHaveLength(1));
        const photo = new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' });

        await userEvent.upload(screen.getByLabelText('Picture'), photo);

        await waitFor(() => expect(runs).toHaveLength(2));
        expect(runs[1].options.args[0]).toBe('photo.jpg');
        expect(runs[1].options.files).toEqual({ 'photo.jpg': photo });
        expect(URL.createObjectURL).toHaveBeenCalledWith(photo);
        expect(screen.getByAltText('Image filter input').getAttribute('src')).toMatch(/^blob:/);

        await userEvent.click(screen.getByRole('button', { name: 'Use the example picture' }));
        await waitFor(() => expect(runs).toHaveLength(3));
        expect(runs[2].options.args[0]).toBe('input.png');
        expect(screen.getByAltText('Image filter input')).toHaveAttribute('src', '/assets/zgal/image_filter/assets/input.png');

        // The picker no longer holds the picture, so choosing it again is a change
        expect((screen.getByLabelText('Picture') as HTMLInputElement).files ?? []).toHaveLength(0);
        await userEvent.upload(screen.getByLabelText('Picture'), photo);
        await waitFor(() => expect(runs).toHaveLength(4));
        expect(runs[3].options.args[0]).toBe('photo.jpg');
    });

    it('runs again with the same settings when the sample is chosen again', async () => {
        const { runs, load } = fakeProgram();
        const { rerender } = render(<ImageFilterDemo sample={FILTER} webGPU load={load} run={0} />);
        await waitFor(() => expect(runs).toHaveLength(1));
        await userEvent.click(screen.getByRole('switch', { name: 'Edges' }));
        await waitFor(() => expect(runs).toHaveLength(2));

        rerender(<ImageFilterDemo sample={FILTER} webGPU load={load} run={1} />);

        await waitFor(() => expect(runs).toHaveLength(3));
        expect(runs[2].options.args).toEqual(runs[1].options.args);
    });

    it('shows the pictures filtered at build time when the example picture fails to filter', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { runs, load } = fakeProgram();
        const { container } = render(<ImageFilterDemo sample={FILTER} webGPU load={load} />);
        await waitFor(() => expect(runs).toHaveLength(1));

        await act(async () => {
            runs[0].options.onMessage?.('image_filter: no WebGPU adapter');
            runs[0].options.onState?.('failed');
            runs[0].end('failed');
        });

        expect(container.firstElementChild).toHaveAttribute('data-zgal', 'failed');
        // With the program's reason, on the page and in the console
        expect(screen.getByRole('alert')).toHaveTextContent("Image filter couldn't run in this browser.image_filter: no WebGPU adapter");
        expect(warn).toHaveBeenCalledWith('Image filter failed: image_filter: no WebGPU adapter');
        expect(screen.getByAltText('Image filter input')).toHaveAttribute('src', '/assets/zgal/image_filter/input.webp');
        expect(screen.getByAltText('Image filter output')).toHaveAttribute('src', '/assets/zgal/image_filter/blur_edges.webp');
        expect(screen.queryByRole('link', { name: 'Download' })).not.toBeInTheDocument();
    });

    it("says why a chosen picture couldn't be filtered", async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { runs, load } = fakeProgram();
        render(<ImageFilterDemo sample={FILTER} webGPU load={load} />);
        await waitFor(() => expect(runs).toHaveLength(1));
        await runs[0].succeed();
        await userEvent.upload(screen.getByLabelText('Picture'), new File(['text'], 'notes.png', { type: 'image/png' }));
        await waitFor(() => expect(runs).toHaveLength(2));

        await act(async () => {
            runs[1].options.onMessage?.('image_filter: notes.png: not an image');
            runs[1].end('failed');
        });

        expect(screen.getByRole('alert')).toHaveTextContent("Image filter couldn't filter notes.png: image_filter: notes.png: not an image");
        // Neither the last picture's output nor the build's
        expect(screen.queryByAltText('Image filter output')).not.toBeInTheDocument();

        // A run that fails without a message
        await userEvent.upload(screen.getByLabelText('Picture'), new File(['text'], 'empty.png', { type: 'image/png' }));
        await waitFor(() => expect(runs).toHaveLength(3));
        await act(async () => {
            runs[2].end('failed');
        });
        expect(screen.getByRole('alert')).toHaveTextContent("Image filter couldn't filter empty.png: it failed.");
    });

    it('says so when its main fails to load', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const load = vi.fn(async () => {
            throw new Error('404');
        });
        render(<ImageFilterDemo sample={FILTER} webGPU load={load} />);

        expect(await screen.findByRole('alert')).toHaveTextContent("Image filter couldn't run in this browser./assets/zgal/image_filter/image_filter.zgal.main.js: 404");
        expect(warn).toHaveBeenCalledWith('Image filter failed: /assets/zgal/image_filter/image_filter.zgal.main.js: 404');
    });

    it('stops its run when it goes', async () => {
        const { runs, load } = fakeProgram();
        const { unmount } = render(<ImageFilterDemo sample={FILTER} webGPU load={load} />);
        await waitFor(() => expect(runs).toHaveLength(1));

        unmount();

        await waitFor(() => expect(runs[0].stop).toHaveBeenCalled());
    });

    it('shows the pictures filtered at build time, without controls, in a browser without WebGPU', () => {
        const { load } = fakeProgram();
        render(<ImageFilterDemo sample={FILTER} webGPU={false} load={load} />);

        expect(load).not.toHaveBeenCalled();
        expect(screen.queryByRole('switch')).not.toBeInTheDocument();
        expect(screen.getByAltText('Image filter input')).toHaveAttribute('src', '/assets/zgal/image_filter/input.webp');
        expect(screen.getByAltText('Image filter output')).toHaveAttribute('src', '/assets/zgal/image_filter/blur_edges.webp');
    });

    it('is offered on the ZGAL page, which says what stands in for it without WebGPU', async () => {
        setWebGPU(false);
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => '(graph FilterGraph)\n', json: async () => ({}) }) as unknown as Response));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        render(
            <MemoryRouter initialEntries={['/projects/zgal?sample=image_filter']}>
                <ZgalPage />
            </MemoryRouter>,
        );

        expect(screen.getByRole('button', { name: 'Image filter' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('heading', { name: 'image_filter.zgal' })).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent('This program needs a browser that supports WebGPU, so below is what it made when the site was built.');
        expect(screen.getByAltText('Image filter output')).toHaveAttribute('src', '/assets/zgal/image_filter/blur_edges.webp');
        await waitFor(() => expect(screen.getByLabelText('image_filter.zgal').textContent).toBe('(graph FilterGraph)\n'));
    });
});

// Moves a slider as a drag does: an input event per step
function fireChange(input: HTMLElement, value: string) {
    act(() => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}
