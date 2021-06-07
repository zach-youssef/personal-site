import React, { useEffect, useState } from 'react';
import { Container, Dropdown, Row, Col, ButtonGroup, Button, ButtonToolbar } from 'react-bootstrap';
import { Stage, Layer } from 'react-konva';
import { fetchGraphQL } from '../../FetchHelper';
import SokobanGrid from './SokobanGrid';
import SokobanSquare, { SquareType } from './SokobanSquare';

interface SokobanRow {
    row: string[]
}

interface SokobanLevel {
    level: SokobanRow[]
}

enum Move {
    UP, DOWN, LEFT, RIGHT
}

function forceMapSquare(raw: string): SquareType {
    switch(raw) {
        case "WALL":
            return SquareType.WALL
        case "EMPTY":
            return SquareType.EMPTY
        case "SPOT":
            return SquareType.SPOT
        case "BOX":
            return SquareType.BOX
        case "PLAYER":
            return SquareType.PLAYER
        case "PLAYER_ON_SPOT":
            return SquareType.PLAYER_ON_SPOT
        case "FILLED_SPOT":
            return SquareType.FILLED_SPOT
        default: 
            return SquareType.EMPTY
    }
}


function Sokoban() {
    const nullLevel: SquareType[][] = []
    const nullSolutionData: Move[] = []

    // Id and state of current level
    const [levelId, setLevelId] = useState(null)
    const [levelData, setLevelData] = useState(nullLevel)
    const [solutionData, setSolutionData] = useState(nullSolutionData)
    const [solutionIndex, setSolutionIndex] = useState(0)
    // const [loadNextState, setLoadNextState] = useState(false)

    function loadNextState(index: number) {
        console.log(index)
        fetchGraphQL(`
            query GetStateAfterActionsQuery($level: SokobanLevelId!, $actions: [SokobanMove!]!) {
                levelAfterActions(levelId: $level, actions: $actions) {
                    level {
                        row
                    }
                }
            }
        `, {
            "level" : levelId,
            "actions" : solutionData.filter((_, idx) => idx < index)
        }).then(response => {
            const sokobanLevel: SokobanLevel = response.data.levelAfterActions
            setLevelData(sokobanLevel.level.map(row => row.row.map(square => forceMapSquare(square))))
            setSolutionIndex(index)
        }).catch(console.log)
    }

    useEffect(() => {
        if (levelData.length === 0 && levelId != null){
            fetchGraphQL(`
                query GetLevelAndSolution($level: SokobanLevelId!) {
                    sokobanLevel(levelId: $level) {
                        level {
                            row
                        }
                    },
                    aStarSolution(levelId: $level)
                }
            `, {"level": levelId}).then(response => {
                const sokobanLevel: SokobanLevel = response.data.sokobanLevel
                setLevelData(sokobanLevel.level.map(row => row.row.map(square => forceMapSquare(square))))
                
                const aiMoves: Move[] = response.data.aStarSolution
                setSolutionData(aiMoves)
                setSolutionIndex(0)
            }).catch(console.log);
        }
    })
    
    // List of available levels in dropdown
    const [levelIds, setLevelIds] = useState([])
    useEffect(() => {
        let isMounted = true;
        fetchGraphQL(`
            query GetAvailableLevelsQuery {
                levels
            }
        `, {}).then(response => {
            if (!isMounted) {
                return;
            }
            const data = response.data
            setLevelIds(data.levels);
        }).catch(error => {
            console.log(error)
        });
        
        return () => { 
            isMounted = false ;
        };
    }, [fetchGraphQL])

    return (
        <Container>
            <ButtonToolbar>
                <Dropdown>
                    <Dropdown.Toggle>
                        Level Select
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                        {levelIds.map(levelId => (
                            <Dropdown.Item
                                onSelect = {() => {
                                    setLevelData([]);
                                    setLevelId(levelId);
                                }}
                            >
                                {levelId}
                            </Dropdown.Item>
                        ))}
                    </Dropdown.Menu>
                </Dropdown>
                <Dropdown>
                    <Dropdown.Toggle variant="secondary">
                        Agent Select
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                        <Dropdown.Item> AStar </Dropdown.Item>
                        <Dropdown.Item disabled> QAgent </Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
            </ButtonToolbar>

            <SokobanGrid data={levelData}/>

            <ButtonGroup>
                <Button 
                    disabled={solutionIndex >= solutionData.length}
                    onClick={ () => {
                        loadNextState(solutionIndex + 1)
                    }}
                > 
                    Next Move 
                </Button>
                <Button 
                    disabled={solutionIndex <= 0} 
                    variant="secondary"
                    onClick={() => {
                        loadNextState(solutionIndex - 1)
                    }}
                > 
                    Undo 
                </Button>
            </ButtonGroup>
        </Container>
    );
}

export default Sokoban;