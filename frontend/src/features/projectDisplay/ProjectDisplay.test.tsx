import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route } from 'react-router-dom';
import { ProjectDisplayCard, ProjectDisplayFeatured } from './ProjectDisplay';
import { projects } from '../../testUtils/mockGraphQL';

describe('ProjectDisplayCard', () => {
    it('shows the project and links relative to the current route', () => {
        render(
            <MemoryRouter initialEntries={['/projects']}>
                <Route path="/projects">
                    <ProjectDisplayCard projectInfo={projects.sokoban} />
                </Route>
            </MemoryRouter>
        );

        expect(screen.getByText('Sokoban AI')).toBeInTheDocument();
        expect(screen.getByText(projects.sokoban.description)).toBeInTheDocument();
        expect(screen.getByRole('img')).toHaveAttribute('src', projects.sokoban.imagePath);
        // Cards load as they're scrolled to
        expect(screen.getByRole('img')).toHaveAttribute('loading', 'lazy');
        expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute('href', '/projects/sokoban');
    });
});

describe('ProjectDisplayFeatured', () => {
    it('shows the featured project with its image', () => {
        render(<ProjectDisplayFeatured projectInfo={projects.vkPPU} />);

        expect(screen.getByText('Vulkan Retro PPU')).toBeInTheDocument();
        expect(screen.getByText(projects.vkPPU.description)).toBeInTheDocument();
        expect(screen.getByAltText('Vulkan Retro PPU')).toHaveAttribute('src', projects.vkPPU.imagePath);
        // The featured image is near the top of the page, so it loads right away
        expect(screen.getByAltText('Vulkan Retro PPU')).not.toHaveAttribute('loading');
    });

    it('lazy-loads the images of later featured projects', () => {
        render(<ProjectDisplayFeatured projectInfo={projects.zgal} index={1} />);

        expect(screen.getByAltText('ZGAL')).toHaveAttribute('loading', 'lazy');
    });
});
