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

    it('loads and lists the featured projects under their own heading', async () => {
        const server = mockGraphQL({ projectInfos: () => [projects.vkPPU, projects.zgal] });
        render(<Home />);

        expect(await screen.findByText('Vulkan Retro PPU')).toBeInTheDocument();
        expect(screen.getByText('ZGAL')).toBeInTheDocument();
        expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent))
            .toEqual(['About Me', 'Featured Projects']);
        expect(screen.getAllByRole('link', { name: 'View' }).map(link => link.getAttribute('href')))
            .toEqual([`/projects/${projects.vkPPU.id}`, `/projects/${projects.zgal.id}`]);
        expect(server.requests()).toHaveLength(1);
        expect(server.requests()[0].query).toMatch(/projectInfos\(featured: true\)/);
    });

    it('ends the featured projects with a link to every project', async () => {
        mockGraphQL({ projectInfos: () => [projects.vkPPU, projects.zgal] });
        const { container } = render(<Home />);

        const seeMore = await screen.findByRole('link', { name: 'See more' });
        expect(seeMore).toHaveAttribute('href', '/projects');
        // Full width, after the last card
        expect(seeMore).toHaveClass('btn-block');
        expect(container.querySelector('.featured-projects > :last-child')).toBe(seeMore);
    });

    it('only lazy-loads the images of featured projects after the first', async () => {
        mockGraphQL({ projectInfos: () => [projects.vkPPU, projects.zgal] });
        render(<Home />);

        expect(await screen.findByAltText('Vulkan Retro PPU')).not.toHaveAttribute('loading');
        expect(screen.getByAltText('ZGAL')).toHaveAttribute('loading', 'lazy');
    });

    it('leaves out the featured section when nothing is featured', async () => {
        const server = mockGraphQL({ projectInfos: () => [] });
        render(<Home />);

        await vi.waitFor(() => expect(server.requests()).toHaveLength(1));
        expect(screen.queryByRole('heading', { name: 'Featured Projects' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'See more' })).not.toBeInTheDocument();
    });

    it('logs and survives a failed request', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
        render(<Home />);

        await vi.waitFor(() => expect(error).toHaveBeenCalledWith(new TypeError('Failed to fetch')));
        expect(screen.getByRole('heading', { name: 'About Me' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Featured Projects' })).not.toBeInTheDocument();
    });
});
