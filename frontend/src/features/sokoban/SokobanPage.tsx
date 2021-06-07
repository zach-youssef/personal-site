import React from 'react';
import { Container } from 'react-bootstrap';
import { Stage, Layer } from 'react-konva';
import SokobanGrid from './SokobanGrid';
import SokobanSquare, { SquareType } from './SokobanSquare';

function Sokoban() {
    const dummyLevel = [
        [SquareType.WALL, SquareType.WALL, SquareType.WALL, SquareType.WALL, SquareType.WALL, SquareType.WALL, SquareType.WALL],
        [SquareType.WALL, SquareType.PLAYER, SquareType.EMPTY, SquareType.BOX, SquareType.EMPTY, SquareType.SPOT, SquareType.WALL],
        [SquareType.WALL, SquareType.PLAYER_ON_SPOT, SquareType.EMPTY, SquareType.FILLED_SPOT, SquareType.EMPTY, SquareType.SPOT, SquareType.WALL],
        [SquareType.WALL, SquareType.WALL, SquareType.WALL, SquareType.WALL, SquareType.WALL, SquareType.WALL, SquareType.WALL],
    ]
    return (
        <Container>
            <p>Insert options here</p>
            <SokobanGrid data={dummyLevel}/>
            <p>Insert forward / back butons here</p>
        </Container>
    );
}

export default Sokoban;