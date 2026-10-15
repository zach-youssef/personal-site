import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SokobanPage from './SokobanPage';
import { mockGraphQL, sokobanResolvers } from '../../testUtils/mockGraphQL';

// Pixel x coordinate of the player's circle; squares are 60px wide at the default window size
function playerColumn(container: HTMLElement) {
    const player = container.querySelector<HTMLElement>('[data-shape="Circle"][data-fill="blue"]');
    return player ? (Number(player.dataset.x) - 30) / 60 : undefined;
}

describe('SokobanPage', () => {
    let server: ReturnType<typeof mockGraphQL>;

    beforeEach(() => {
        server = mockGraphQL(sokobanResolvers());
        // The page logs every response and key press
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    const lastActions = () => server.requests().filter(r => /levelAfterActions/.test(r.query)).pop()?.variables;

    async function renderLoaded() {
        const view = render(<SokobanPage />);
        await waitFor(() => expect(playerColumn(view.container)).toBe(1));
        return view;
    }

    it('loads the first level with its A* solution', async () => {
        await renderLoaded();

        const levelRequest = server.requests().find(r => /sokobanLevel/.test(r.query));
        expect(levelRequest?.variables).toEqual({ level: 'LEVEL_0' });
        expect(screen.getByText('Next Move')).toBeEnabled();
        expect(screen.getByText('Undo')).toBeDisabled();
    });

    it('steps forward and back through the solution using the server', async () => {
        const { container } = await renderLoaded();

        await userEvent.click(screen.getByText('Next Move'));
        await waitFor(() => expect(playerColumn(container)).toBe(2));
        expect(lastActions()).toEqual({ level: 'LEVEL_0', actions: ['RIGHT'] });

        await userEvent.click(screen.getByText('Next Move'));
        await waitFor(() => expect(playerColumn(container)).toBe(3));
        expect(lastActions()).toEqual({ level: 'LEVEL_0', actions: ['RIGHT', 'RIGHT'] });

        await userEvent.click(screen.getByText('Undo'));
        await waitFor(() => expect(playerColumn(container)).toBe(2));
        expect(lastActions()).toEqual({ level: 'LEVEL_0', actions: ['RIGHT'] });
    });

    it('reaches the solved state at the end of the solution', async () => {
        const { container } = await renderLoaded();

        for (let i = 0; i < 3; i++) {
            await userEvent.click(screen.getByText('Next Move'));
        }

        await waitFor(() => expect(container.querySelector('[data-shape="Rect"][data-fill="green"]')).toBeInTheDocument());
        expect(screen.getByText('Next Move')).toBeDisabled();
    });

    it('moves the player with arrow keys in manual mode', async () => {
        const { container } = await renderLoaded();

        await userEvent.click(screen.getByText('Agent Select'));
        await userEvent.click(screen.getByText('Manual'));
        await waitFor(() => expect(screen.getByText('Next Move')).toBeDisabled());

        fireEvent.keyDown(document, { key: 'ArrowRight' });
        await waitFor(() => expect(playerColumn(container)).toBe(2));
        // Manual moves are sent as ordinals of the page's Move enum, which matches the server's SokobanMove order
        expect(lastActions()).toEqual({ level: 'LEVEL_0', actions: [3] });

        fireEvent.keyDown(document, { key: 'ArrowLeft' });
        await waitFor(() => expect(playerColumn(container)).toBe(1));
        expect(lastActions()).toEqual({ level: 'LEVEL_0', actions: [3, 2] });

        // Other keys are ignored
        const requestCount = server.requests().length;
        fireEvent.keyDown(document, { key: 'a' });
        expect(server.requests()).toHaveLength(requestCount);
    });

    it('ignores arrow keys when an agent is playing', async () => {
        await renderLoaded();
        const requestCount = server.requests().length;

        fireEvent.keyDown(document, { key: 'ArrowRight' });

        expect(server.requests()).toHaveLength(requestCount);
    });

    it('switches to the Q learning agent solution', async () => {
        const { container } = await renderLoaded();

        await userEvent.click(screen.getByText('Agent Select'));
        await userEvent.click(screen.getByText('QAgent'));
        await waitFor(() => expect(playerColumn(container)).toBe(1));

        // The Q learning solution starts RIGHT, LEFT
        await userEvent.click(screen.getByText('Next Move'));
        await userEvent.click(screen.getByText('Next Move'));
        await waitFor(() => expect(lastActions()).toEqual({ level: 'LEVEL_0', actions: ['RIGHT', 'LEFT'] }));
        await waitFor(() => expect(playerColumn(container)).toBe(1));
    });
});
