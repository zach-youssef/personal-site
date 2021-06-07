import React from 'react';
import { Rect, Circle } from 'react-konva'
import { SquareType, sideLength } from './SokobanSquare';

interface Props {
    type: SquareType
    row: number,
    col: number
}

function SokobanPiece({type, row, col}: Props) {
    if (type === SquareType.BOX || type === SquareType.FILLED_SPOT) {
        const squareBuffer = sideLength / 10
        return (
            <Rect 
                x = {(col * sideLength) + squareBuffer}
                y = {(row * sideLength) + squareBuffer}
                width = {sideLength - (squareBuffer * 2)}
                height = {sideLength - (squareBuffer * 2)}
                fill = {type === SquareType.BOX? 'brown' : 'green'}
                strokeWidth={2}
                stroke="black"
            />
        )
    } else if(type === SquareType.PLAYER || type === SquareType.SPOT) {
        return (
            <Circle 
                x = {(col * sideLength) + (sideLength / 2)}
                y = {(row * sideLength) + (sideLength / 2)}
                radius = {sideLength / (type === SquareType.PLAYER? 2.5 : 4.5)}
                fill = {type === SquareType.PLAYER? 'blue' : 'red'}
                strokeWidth = {2}
                stroke="black"
            />
        )
    } else {
        return (
            <Rect />
        )
    }
}

export default SokobanPiece;