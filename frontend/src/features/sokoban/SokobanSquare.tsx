import React from 'react';
import { Rect } from 'react-konva'

export enum SquareType {
    WALL,
    EMPTY,
    PLAYER,
    BOX,
    SPOT,
    FILLED_SPOT,
    PLAYER_ON_SPOT
}

interface Props {
    type: SquareType,
    row: number,
    col: number,
    sideLength? : number,
}

function SokobanSquare({type, row, col, sideLength = 60}: Props) {
    return (
        <Rect
            x={col * sideLength}
            y={row * sideLength}
            width={sideLength}
            height={sideLength}
            fill= {type === SquareType.WALL? 'grey' : 'tan'}
            strokeWidth={2}
            stroke="black"
        />
    )
}

export default SokobanSquare;