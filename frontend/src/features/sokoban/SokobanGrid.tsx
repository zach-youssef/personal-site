import React, {useLayoutEffect, useState} from 'react';
import { Stage, Layer } from 'react-konva';
import SokobanSquare, { SquareType } from './SokobanSquare';
import SokobanPiece from './SokobanPiece';
import { Spinner } from 'react-bootstrap';

interface Props {
    data: SquareType[][]
}

function SokobanGrid({data}: Props) {
    const [screenSize, setScreenSize] = useState(1024);
    const updateScreenSize = () => setScreenSize(window.innerWidth);
    useLayoutEffect(() => {
        updateScreenSize();
        window.addEventListener('resize', updateScreenSize);
        return () => window.removeEventListener('resize', updateScreenSize);
    }, []);

    if (data.length === 0) {
        return (
            <Spinner animation="border" variant="dark"/>
        )
    }

    let shrinkThreshold = 512;
    let sideLength = screenSize > shrinkThreshold ? 60 : 40;

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
                            <SokobanSquare type={squareType} row={rowIndex} col={colIndex} sideLength={sideLength}/>
                        )
                    )
                )}
                {/* Draw the pieces on the grid */}
                {data.flatMap((rowData, rowIndex) => 
                    rowData.map((squareType, colIndex) => 
                        (
                            <SokobanPiece type={squareType} row={rowIndex} col={colIndex} sideLength={sideLength}/>
                        )
                    )
                )}
            </Layer>
        </Stage>
    )
}

export default SokobanGrid;