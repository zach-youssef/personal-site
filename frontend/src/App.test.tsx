import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import { mockGraphQL, projects, sokobanResolvers } from './testUtils/mockGraphQL';

// App and ProjectsPage each use a BrowserRouter, so routing is driven by the window location
function renderAt(path: string) {
    window.history.pushState({}, '', path);
    return render(<App />);
}

describe('App routing', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        window.history.pushState({}, '', '/');
    });

    it('renders the home page at the root', async () => {
        mockGraphQL({ projectInfos: () => [projects.vkPPU] });
        renderAt('/');

        expect(screen.getByRole('heading', { name: 'About Me' })).toBeInTheDocument();
        expect(await screen.findByText('Featured: Vulkan Retro PPU')).toBeInTheDocument();
    });

    it('renders a section per project category on the projects page', async () => {
        const server = mockGraphQL({
            projectInfos: ({ category }) => category === 'PERSONAL' ? [projects.vkPPU] : [],
        });
        renderAt('/projects');

        expect(screen.getByRole('heading', { name: 'Professional Work' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'University Projects' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Side Projects' })).toBeInTheDocument();
        expect(await screen.findByText('Vulkan Retro PPU')).toBeInTheDocument();
        expect(server.requests().map(request => request.variables.category).sort())
            .toEqual(['PERSONAL', 'PROFESSIONAL', 'UNIVERSITY']);
    });

    it('routes to a project page', async () => {
        mockGraphQL(sokobanResolvers());
        renderAt('/projects/sokoban');

        expect(screen.getByText('Level Select')).toBeInTheDocument();
        expect(await screen.findByText('Next Move')).toBeEnabled();
        expect(screen.queryByRole('heading', { name: 'University Projects' })).not.toBeInTheDocument();
    });

    it('shows the PPU in the page rather than sending visitors to GitHub', () => {
        renderAt('/projects/vkPPU');

        expect(screen.getByRole('heading', { name: 'Vulkan Retro PPU' })).toBeInTheDocument();
        expect(window.location.pathname).toBe('/projects/vkPPU');
    });
});
