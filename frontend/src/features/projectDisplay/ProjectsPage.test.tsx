import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, Route } from 'react-router-dom';
import ProjectsPage from './ProjectsPage';
import { mockGraphQL, projects, writeups } from '../../testUtils/mockGraphQL';

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

    it('routes /projects/splats to the splat viewer', () => {
        vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
        renderAt('/projects/splats');

        expect(screen.getByRole('heading', { name: 'Gaussian Splatting' })).toBeInTheDocument();
    });

    for (const id of ['broadAR', 'metaAvatars'] as const) {
        it(`routes /projects/${id} to its write-up, in place of the external page it redirected to`, async () => {
            // Every project gets the same write-up: the page itself is tested in ProjectWriteupPage.test
            const server = mockGraphQL({
                projectInfo: ({ id }) => projects[id as keyof typeof projects] ?? null,
                projectWriteup: () => writeups.broadAR,
            });
            const { container } = renderAt(`/projects/${id}`);

            expect(await screen.findByRole('heading', { level: 2 })).toHaveTextContent(projects[id].name);
            expect(server.requests().map(request => request.variables)).toEqual([{ id }]);
            expect(screen.getByText(writeups.broadAR.context)).toBeInTheDocument();
            const back = screen.getByRole('link', { name: 'Back to Projects' });
            expect(container.querySelector(':scope > :last-child a:last-child')).toBe(back);
            expect(window.location.href).toBe(`${window.location.origin}/projects/${id}`);
        });
    }

    it('leaves the link out of the list of projects', () => {
        mockGraphQL({ projectInfos: () => [] });
        renderAt('/projects');

        expect(screen.getByRole('heading', { name: 'Side Projects' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Back to Projects' })).not.toBeInTheDocument();
    });
});
