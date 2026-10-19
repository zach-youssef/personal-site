import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, Route } from 'react-router-dom';
import ProjectsPage from './ProjectsPage';
import { mockGraphQL } from '../../testUtils/mockGraphQL';

function renderAt(path: string) {
    window.history.pushState({}, '', path);
    return render(
        <BrowserRouter>
            <Route path="/projects">
                <ProjectsPage />
            </Route>
        </BrowserRouter>
    );
}

describe('ProjectsPage', () => {
    afterEach(() => {
        window.history.pushState({}, '', '/');
        vi.unstubAllGlobals();
    });

    it('ends a project page with a link back to every project', async () => {
        mockGraphQL({ raytracerImages: () => [] });
        const { container } = renderAt('/projects/raytracer');

        expect(screen.getByRole('heading', { name: 'Browser Raytracer' })).toBeInTheDocument();
        const back = screen.getByRole('link', { name: 'Back to Projects' });
        expect(back).toHaveAttribute('href', '/projects');
        expect(back).toHaveClass('btn-block');
        expect(container.querySelector(':scope > :last-child a:last-child')).toBe(back);
    });

    it('leaves the link out of the list of projects', () => {
        mockGraphQL({ projectInfos: () => [] });
        renderAt('/projects');

        expect(screen.getByRole('heading', { name: 'Side Projects' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Back to Projects' })).not.toBeInTheDocument();
    });
});
