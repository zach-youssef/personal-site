import React from 'react';
import { Container, Dropdown, Row, Col, ButtonGroup, Button, ButtonToolbar } from 'react-bootstrap';
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
            <ButtonToolbar>
                <Dropdown>
                    <Dropdown.Toggle>
                        Level Select
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                        <Dropdown.Item> Test 1 </Dropdown.Item>
                        <Dropdown.Item> Test 2 </Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
                <Dropdown>
                    <Dropdown.Toggle variant="secondary">
                        Agent Select
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                        <Dropdown.Item> AStar </Dropdown.Item>
                        <Dropdown.Item> QAgent </Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
            </ButtonToolbar>

            <SokobanGrid data={dummyLevel}/>

            <ButtonGroup>
                <Button> Next Move </Button>
                <Button variant="secondary"> Undo </Button>
            </ButtonGroup>
        </Container>
    );
}

export default Sokoban;