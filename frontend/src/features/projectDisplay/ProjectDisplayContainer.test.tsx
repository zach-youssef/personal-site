import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route } from 'react-router-dom';
import { vi } from 'vitest';
import ProjectDisplayContainer from './ProjectDisplayContainer';
import { mockGraphQL, projects, setWindowWidth } from '../../testUtils/mockGraphQL';

const universityProjects = [projects.sokoban, projects.seamCarver, projects.vkPPU];

function renderContainer() {
    return render(
        <MemoryRouter initialEntries={['/projects']}>
            <Route path="/projects">
                <ProjectDisplayContainer category="UNIVERSITY" />
            </Route>
        </MemoryRouter>
    );
}

describe('ProjectDisplayContainer', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        setWindowWidth(1024);
    });

    it('requests the projects in its category and renders a card for each', async () => {
        const server = mockGraphQL({ projectInfos: () => universityProjects });
        renderContainer();

        for (const project of universityProjects) {
            expect(await screen.findByText(project.name)).toBeInTheDocument();
        }
        expect(server.requests()[0].variables).toEqual({ category: 'UNIVERSITY' });
        expect(screen.getAllByRole('link', { name: 'View' }).map(link => link.getAttribute('href')))
            .toEqual(['/projects/sokoban', '/projects/seamCarver', '/projects/vkPPU']);
    });

    it.each([
        [1200, 1],
        [800, 2],
        [400, 3],
    ])('lays out cards in rows based on a %ipx wide window', async (width, rows) => {
        setWindowWidth(width);
        mockGraphQL({ projectInfos: () => universityProjects });
        const { container } = renderContainer();

        await screen.findByText(projects.vkPPU.name);
        expect(container.querySelectorAll('.card-group')).toHaveLength(rows);
    });

    it('re-flows cards when the window is resized', async () => {
        setWindowWidth(1200);
        mockGraphQL({ projectInfos: () => universityProjects });
        const { container } = renderContainer();
        await screen.findByText(projects.vkPPU.name);

        act(() => setWindowWidth(400));

        await waitFor(() => expect(container.querySelectorAll('.card-group')).toHaveLength(3));
    });
});
