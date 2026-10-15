import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import SokobanSquare, { SquareType } from './SokobanSquare';
import SokobanPiece from './SokobanPiece';
import SokobanGrid from './SokobanGrid';
import { setWindowWidth } from '../../testUtils/mockGraphQL';

function shapes(container: HTMLElement, name: string) {
    return Array.from(container.querySelectorAll<HTMLElement>(`[data-shape="${name}"]`)).map(el => ({ ...el.dataset }));
}

describe('SokobanSquare', () => {
    it('draws walls grey and floor tan at the grid position', () => {
        const { container } = render(<>
            <SokobanSquare type={SquareType.WALL} row={1} col={2} sideLength={10} />
            <SokobanSquare type={SquareType.SPOT} row={0} col={3} />
        </>);

        expect(shapes(container, 'Rect')).toMatchObject([
            { x: '20', y: '10', width: '10', height: '10', fill: 'grey' },
            { x: '180', y: '0', width: '60', height: '60', fill: 'tan' },
        ]);
    });
});

describe('SokobanPiece', () => {
    it.each([
        [SquareType.BOX, 'Rect', 'brown'],
        [SquareType.FILLED_SPOT, 'Rect', 'green'],
        [SquareType.PLAYER, 'Circle', 'blue'],
        [SquareType.SPOT, 'Circle', 'red'],
        [SquareType.PLAYER_ON_SPOT, 'Circle', 'purple'],
    ])('draws square type %i as a %s filled %s', (type, shape, fill) => {
        const { container } = render(<SokobanPiece type={type} row={1} col={1} sideLength={60} />);

        expect(shapes(container, shape)).toMatchObject([{ fill }]);
    });

    it('centres circles in their square and insets boxes', () => {
        const { container } = render(<>
            <SokobanPiece type={SquareType.PLAYER} row={1} col={2} sideLength={60} />
            <SokobanPiece type={SquareType.BOX} row={1} col={2} sideLength={60} />
        </>);

        expect(shapes(container, 'Circle')).toMatchObject([{ x: '150', y: '90', radius: '24' }]);
        expect(shapes(container, 'Rect')).toMatchObject([{ x: '126', y: '66', width: '48', height: '48' }]);
    });

    it.each([SquareType.WALL, SquareType.EMPTY])('draws nothing visible for square type %i', type => {
        const { container } = render(<SokobanPiece type={type} row={0} col={0} sideLength={60} />);

        expect(shapes(container, 'Circle')).toHaveLength(0);
        expect(shapes(container, 'Rect')).toEqual([{ shape: 'Rect' }]);
    });
});

describe('SokobanGrid', () => {
    const level = [
        [SquareType.WALL, SquareType.WALL, SquareType.WALL],
        [SquareType.WALL, SquareType.PLAYER, SquareType.BOX, SquareType.SPOT],
    ];

    afterEach(() => setWindowWidth(1024));

    it('shows a spinner while the level loads', () => {
        const { container } = render(<SokobanGrid data={[]} />);

        expect(container.querySelector('.spinner-border')).toBeInTheDocument();
        expect(shapes(container, 'Stage')).toHaveLength(0);
    });

    it('sizes the stage to the widest row and draws every square and piece', () => {
        setWindowWidth(1024);
        const { container } = render(<SokobanGrid data={level} />);

        expect(shapes(container, 'Stage')).toMatchObject([{ width: '240', height: '120' }]);
        // One floor square per cell, plus a piece per cell
        expect(shapes(container, 'Rect').filter(rect => rect.fill === 'grey')).toHaveLength(4);
        expect(shapes(container, 'Rect').filter(rect => rect.fill === 'tan')).toHaveLength(3);
        expect(shapes(container, 'Circle').map(circle => circle.fill)).toEqual(['blue', 'red']);
    });

    it('uses smaller squares on narrow screens', () => {
        setWindowWidth(400);
        const { container } = render(<SokobanGrid data={level} />);

        expect(shapes(container, 'Stage')).toMatchObject([{ width: '160', height: '80' }]);
    });
});
