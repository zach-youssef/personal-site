import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import RaytracerPage from './raytracer/RaytracerPage';
import WebGLDemoPage from './webgl/WebGLDemoPage';
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
