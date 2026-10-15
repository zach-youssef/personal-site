import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RaytracerPage from './raytracer/RaytracerPage';
import WebGLDemoPage from './webgl/WebGLDemoPage';
import { mockGraphQL } from '../testUtils/mockGraphQL';

describe('RaytracerPage', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('shows the rendered images from the server in a carousel', async () => {
        const images = [
            'http://zyoussef.com/assets/raytracer/ConeAndCylinder.png',
            'http://zyoussef.com/assets/raytracer/ReflectionsAndShadows.png',
        ];
        mockGraphQL({ raytracerImages: () => images });
        render(<RaytracerPage />);

        expect(screen.getByRole('heading', { name: 'Browser Raytracer' })).toBeInTheDocument();
        await vi.waitFor(() => expect(screen.getAllByAltText('Demo').map(img => img.getAttribute('src'))).toEqual(images));
    });

    it('fetches the image list only once', async () => {
        const server = mockGraphQL({ raytracerImages: () => ['http://zyoussef.com/assets/raytracer/a.png'] });
        render(<RaytracerPage />);

        await screen.findByAltText('Demo');
        // Give any re-render triggered fetches a chance to happen
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(server.fetchMock).toHaveBeenCalledTimes(1);
    });
});

describe('WebGLDemoPage', () => {
    it('embeds the demo served by the backend', () => {
        render(<WebGLDemoPage />);

        expect(screen.getByTitle('WebGL Demo')).toHaveAttribute('src', 'http://zyoussef.com/Scenegraphs.html');
    });
});
