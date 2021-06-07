import React, { useEffect, useState } from 'react';
import { Container, Dropdown, Row, Col, ButtonGroup, Button, ButtonToolbar } from 'react-bootstrap';
import { Stage, Layer } from 'react-konva';
import { fetchGraphQL } from '../../FetchHelper';
import SokobanGrid from './SokobanGrid';
import SokobanSquare, { SquareType } from './SokobanSquare';

interface SokobanRow {
    row: SquareType[]
}

interface SokobanLevel {
    level: SokobanRow[]
}

enum Move {
    UP, DOWN, LEFT, RIGHT
}

function Sokoban() {
    const nullLevel: SquareType[][] = []
    const nullSolutionData: Move[] = []

    // Id and state of current level
    const [levelId, setLevelId] = useState(null)
    const [levelData, setLevelData] = useState(nullLevel)
    const [solutionData, setSolutionData] = useState(nullSolutionData)
    useEffect(() => {
        console.log("In the effect")
        console.log(levelData)
        console.log(levelId)
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
                console.log("In the response clause")
                console.log(response)
                const sokobanLevel: SokobanLevel = response.data.sokobanLevel
                setLevelData(sokobanLevel.level.map(row => row.row))
                
                const aiMoves: Move[] = response.data.aStarSolution
                setSolutionData(aiMoves)
            })
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
                <Button> Next Move </Button>
                <Button variant="secondary"> Undo </Button>
            </ButtonGroup>
        </Container>
    );
}

export default Sokoban;