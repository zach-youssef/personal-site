import React from 'react';
import { Rect, Circle, Layer } from 'react-konva'

export enum SquareType {
    WALL,
    EMPTY,
    PLAYER,
    BOX,
    SPOT,
    FILLED_SPOT
}

interface Props {
    type: SquareType,
    row: number,
    col: number
}

export const sideLength = 60

function SokobanSquare({type, row, col}: Props) {
    return (
        <Rect
            x={col * sideLength}
            y={row * sideLength}
            width={sideLength}
            height={sideLength}
            fill= {fillForType(type)}
        />
    )
}

function fillForType(type: SquareType): string {
    switch(type) {
        case SquareType.WALL:
            return 'black'
        case SquareType.EMPTY:
            return 'tan'
        case SquareType.PLAYER:
            return 'blue'
        case SquareType.BOX:
            return 'brown'
        case SquareType.SPOT:
            return 'red'
        case SquareType.FILLED_SPOT:
            return 'green'
    }
}

export default SokobanSquare;