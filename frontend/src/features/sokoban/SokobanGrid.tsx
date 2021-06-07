import React from 'react';
import { Stage, Layer } from 'react-konva';
import SokobanSquare, { SquareType, sideLength } from './SokobanSquare';

interface Props {
    data: SquareType[][]
}

function SokobanGrid({data}: Props) {
    return (
        <Stage 
            height={sideLength * data.length} 
            width={sideLength * data.map(row => row.length).reduce((a,b) => Math.max(a,b))}
        >
            <Layer>
                {data.flatMap((rowData, rowIndex) => 
                    rowData.map((squareType, colIndex) => 
                        (
                            <SokobanSquare type={squareType} row={rowIndex} col={colIndex}/>
                        )
                    )
                )}
            </Layer>
        </Stage>
    )
}

export default SokobanGrid;