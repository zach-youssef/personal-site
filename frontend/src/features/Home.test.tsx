import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from './Home';
import { mockGraphQL, projects } from '../testUtils/mockGraphQL';

describe('Home', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('shows the about me section', () => {
        mockGraphQL({ projectInfos: () => [] });
        render(<Home />);

        expect(screen.getByRole('heading', { name: 'About Me' })).toBeInTheDocument();
        expect(screen.getByText('Software Engineer, Northeastern University Alum.', { exact: false })).toBeInTheDocument();
        expect(screen.getByText('I created this site as an interactive portfolio', { exact: false })).toBeInTheDocument();
    });

    it('loads and shows the featured project', async () => {
        const server = mockGraphQL({ projectInfos: () => [projects.vkPPU] });
        render(<Home />);

        expect(await screen.findByText('Featured: Vulkan Retro PPU')).toBeInTheDocument();
        expect(server.requests().every(request => /projectInfos\(featured: true\)/.test(request.query))).toBe(true);
    });

    it('logs and survives a failed request', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
        render(<Home />);

        await vi.waitFor(() => expect(error).toHaveBeenCalledWith(new TypeError('Failed to fetch')));
        expect(screen.getByRole('heading', { name: 'About Me' })).toBeInTheDocument();
        expect(screen.queryByText(/Featured:/)).not.toBeInTheDocument();
    });
});
