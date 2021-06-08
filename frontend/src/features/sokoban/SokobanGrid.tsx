import React from 'react';
import { Stage, Layer } from 'react-konva';
import SokobanSquare, { SquareType, sideLength } from './SokobanSquare';
import SokobanPiece from './SokobanPiece';
import { Spinner } from 'react-bootstrap';

interface Props {
    data: SquareType[][]
}

function SokobanGrid({data}: Props) {
    if (data.length === 0) {
        return (
            <Spinner animation="border" variant="dark"/>
        )
    }

    return (
        <Stage 
            height={sideLength * data.length} 
            width={data.length === 0? 0 : sideLength * data.map(row => row.length).reduce((a,b) => Math.max(a,b))}
        >
            <Layer>
                {/* Draw the squares of the grid */}
                {data.flatMap((rowData, rowIndex) => 
                    rowData.map((squareType, colIndex) => 
                        (
                            <SokobanSquare type={squareType} row={rowIndex} col={colIndex}/>
                        )
                    )
                )}
                {/* Draw the pieces on the grid */}
                {data.flatMap((rowData, rowIndex) => 
                    rowData.map((squareType, colIndex) => 
                        (
                            <SokobanPiece type={squareType} row={rowIndex} col={colIndex}/>
                        )
                    )
                )}
            </Layer>
        </Stage>
    )
}

export default SokobanGrid;