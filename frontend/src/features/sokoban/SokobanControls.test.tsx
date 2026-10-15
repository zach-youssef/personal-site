import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SokobanStepperControls from './SokobanStepperControls';
import AgentSelector, { AgentType } from './dropdowns/AgentSelect';
import LevelSelector from './dropdowns/LevelSelector';
import { mockGraphQL } from '../../testUtils/mockGraphQL';

describe('SokobanStepperControls', () => {
    function renderControls(currentIndex: number, solutionLength: number, disableNext = false) {
        const onNext = vi.fn();
        const onUndo = vi.fn();
        render(<SokobanStepperControls
            currentIndex={currentIndex}
            solutionLength={solutionLength}
            disableNext={disableNext}
            onNext={onNext}
            onUndo={onUndo}
        />);
        return { onNext, onUndo, next: screen.getByText('Next Move'), undo: screen.getByText('Undo') };
    }

    it('only allows moving forward at the start of a solution', async () => {
        const { next, undo, onNext } = renderControls(0, 3);

        expect(next).toBeEnabled();
        expect(undo).toBeDisabled();
        await userEvent.click(next);
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('allows both directions mid-solution', async () => {
        const { next, undo, onUndo } = renderControls(1, 3);

        expect(next).toBeEnabled();
        expect(undo).toBeEnabled();
        await userEvent.click(undo);
        expect(onUndo).toHaveBeenCalledTimes(1);
    });

    it('only allows undo at the end of a solution', () => {
        const { next, undo } = renderControls(3, 3);

        expect(next).toBeDisabled();
        expect(undo).toBeEnabled();
    });

    it('disables next when requested, e.g. in manual mode', () => {
        expect(renderControls(0, 3, true).next).toBeDisabled();
    });
});

describe('AgentSelector', () => {
    it.each([
        ['AStar', AgentType.ASTAR],
        ['Manual', AgentType.MANUAL],
        ['QAgent', AgentType.QAGENT],
    ])('reports selecting %s', async (label, agent) => {
        const onAgentSelect = vi.fn();
        render(<AgentSelector onAgentSelect={onAgentSelect} />);

        await userEvent.click(screen.getByText('Agent Select'));
        await userEvent.click(screen.getByText(label));

        expect(onAgentSelect).toHaveBeenCalledWith(agent);
    });
});

describe('LevelSelector', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('loads the available levels and selects the first one', async () => {
        mockGraphQL({ levels: () => ['LEVEL_0', 'LEVEL_1', 'LEVEL_2'] });
        const onLevelSelect = vi.fn();
        render(<LevelSelector onLevelSelect={onLevelSelect} />);

        await vi.waitFor(() => expect(onLevelSelect).toHaveBeenCalledWith('LEVEL_0'));

        await userEvent.click(screen.getByText('Level Select'));
        expect(screen.getByText('LEVEL_1')).toBeInTheDocument();
        await userEvent.click(screen.getByText('LEVEL_2'));
        expect(onLevelSelect).toHaveBeenLastCalledWith('LEVEL_2');
    });
});
