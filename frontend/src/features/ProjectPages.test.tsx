import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import RaytracerPage from './raytracer/RaytracerPage';
import WebGLDemoPage from './webgl/WebGLDemoPage';
import PpuPage, { GITHUB_URL } from './ppu/PpuPage';
import ZgalPage, { GITHUB_URL as ZGAL_GITHUB_URL } from './zgal/ZgalPage';
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
        await vi.waitFor(() => expect(screen.getAllByAltText('Demo').map(img => img.getAttribute('src'))).toEqual(images));
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

    function serveSource(response: Partial<Response>) {
        const fetchMock = vi.fn(async () => response as Response);
        vi.stubGlobal('fetch', fetchMock);
        return fetchMock;
    }

    afterEach(() => {
        setWebGPU(false);
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('links to the project on GitHub', () => {
        serveSource({ ok: true, text: async () => SOURCE });
        render(<ZgalPage />);

        expect(screen.getByRole('heading', { name: 'ZGAL', level: 2 })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'View on GitHub' })).toHaveAttribute('href', ZGAL_GITHUB_URL);
    });

    it('runs the particles example beside its source', async () => {
        setWebGPU(true);
        const fetchMock = serveSource({ ok: true, text: async () => SOURCE });
        render(<ZgalPage />);

        expect(screen.getByTitle('Particles')).toHaveAttribute('src', '/assets/zgal/particles/particles.zgal.html');
        expect(fetchMock).toHaveBeenCalledWith('/assets/zgal/particles/particles.zgal');
        await vi.waitFor(() => expect(screen.getByLabelText('particles.zgal').textContent).toBe(SOURCE));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('scales the example to its frame', () => {
        setWebGPU(true);
        serveSource({ ok: true, text: async () => SOURCE });
        render(<ZgalPage />);
        const frame = screen.getByTitle('Particles');
        const programDocument = document.implementation.createHTMLDocument();
        Object.defineProperty(frame, 'contentDocument', { value: programDocument });

        act(() => {
            frame.dispatchEvent(new Event('load'));
        });

        expect(programDocument.head.querySelector('style')?.textContent).toContain('canvas#zgal { width: 100% !important; height: 100% !important;');
    });

    it('shows a frame from the example when the browser has no WebGPU', () => {
        setWebGPU(false);
        serveSource({ ok: true, text: async () => SOURCE });
        const { container } = render(<ZgalPage />);

        expect(screen.getByRole('alert')).toHaveTextContent('This program needs a browser that supports WebGPU');
        expect(container.querySelector('iframe')).toBeNull();
        expect(screen.getByAltText('Particles')).toHaveAttribute('src', '/assets/zgal/particles/screenshot.webp');
    });

    it('says so when the source fails to load', async () => {
        setWebGPU(true);
        serveSource({ ok: false, status: 404 });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        render(<ZgalPage />);

        expect(await screen.findByRole('alert')).toHaveTextContent("The program's source couldn't be loaded.");
    });

    it('says so when the example fails to run', async () => {
        setWebGPU(true);
        serveSource({ ok: true, text: async () => SOURCE });
        render(<ZgalPage />);
        const frame = screen.getByTitle('Particles');
        const programDocument = document.implementation.createHTMLDocument();
        Object.defineProperty(frame, 'contentDocument', { value: programDocument });

        act(() => {
            frame.dispatchEvent(new Event('load'));
        });
        programDocument.documentElement.dataset.zgal = 'failed';

        expect(await screen.findByRole('alert')).toHaveTextContent("Particles couldn't run in this browser.");
    });
});
