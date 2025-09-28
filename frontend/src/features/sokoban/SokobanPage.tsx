import React, { useState, useEffect, useCallback } from 'react';
import { Container,  ButtonToolbar } from 'react-bootstrap';
import { fetchGraphQL } from '../../FetchHelper';
import SokobanGrid from './SokobanGrid';
import { SquareType } from './SokobanSquare';
import SokobanStepperControls from './SokobanStepperControls';
import { GetStateAfterActionsQuery, GetLevelAndSolutionQuery } from '././../../graphql/SokobanQuieries'
import LevelSelector from './dropdowns/LevelSelector';
import AgentSelector, { AgentType } from './dropdowns/AgentSelect';

interface SokobanRow {
    row: string[]
}

interface SokobanLevel {
    level: SokobanRow[]
}

enum Move {
    UP, DOWN, LEFT, RIGHT, UNDEF
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

    // Tracks which agent is currently in use
    const [agentType, setAgentType] = useState(AgentType.ASTAR);

    // Handle keypress input in manual mode
    const onKeyDown = useCallback(({key}) => {
        if (agentType === AgentType.MANUAL) {
            console.log(key);
            var move: Move = Move.UNDEF;
            switch(key) {
                case "ArrowUp" :
                    move = Move.UP;
                    break;
                case "ArrowDown" :
                    move = Move.DOWN;
                    break;
                case "ArrowLeft" :
                    move = Move.LEFT;
                    break;
                case "ArrowRight" :
                    move = Move.RIGHT;
                    break;
            }
            if (move !== Move.UNDEF) {
                let newData = [...solutionData];
                newData[solutionIndex] = move;
                console.log(newData)
                loadNextState(solutionIndex + 1, newData);
            }
        }
        // eslint-disable-next-line
    }, [agentType, solutionData, solutionIndex])

    useEffect(() => {
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
        }
        // eslint-disable-next-line
    }, [agentType, solutionData, solutionIndex]);

    function loadNextState(index: number, solutionData: Move[]) {
        fetchGraphQL(GetStateAfterActionsQuery, {
            "level" : levelId,
            "actions" : solutionData.filter((_, idx) => idx < index)
        }).then(response => {
            if (response.data) {
                const sokobanLevel: SokobanLevel = response.data.levelAfterActions
                setLevelData(sokobanLevel.level.map(row => row.row.map(square => forceMapSquare(square))))
                setSolutionData(solutionData)
                setSolutionIndex(index)
            }
        }).catch(console.log)
    }
    
    function loadLevel(levelId: any, agentType: AgentType) {
        setLevelData([]) // Clear existing data to show loading screen
        fetchGraphQL(GetLevelAndSolutionQuery, {
            "level": levelId
        }).then(response => {
            console.log(response);
            const sokobanLevel: SokobanLevel = response.data.sokobanLevel;
            setLevelData(sokobanLevel.level.map(row => row.row.map(square => forceMapSquare(square))));
            
            console.log("AGENT TYPE = %s", agentType)
            switch(agentType) {
                case AgentType.ASTAR:
                    const aiMoves: Move[] = response.data.aStarSolution
                    setSolutionData(aiMoves);
                    setSolutionIndex(0);
                    break;
                case AgentType.MANUAL:
                    setSolutionData([]);
                    setSolutionIndex(0);
                    break;
                case AgentType.QAGENT:
                    const qMoves: Move[] = response.data.qLearningSolution
                    setSolutionData(qMoves);
                    setSolutionIndex(0);
                    break;
                default:
                    console.log("UNKNOWN AGENT %s", agentType)
            }
        }).catch(console.log);
    }

    return (
        <Container>
            <ButtonToolbar>

                <LevelSelector 
                  onLevelSelect={id => {
                      if (id !== levelId) {
                        setLevelId(id);
                        loadLevel(id, agentType)
                      }
                  }}
                />

                <AgentSelector onAgentSelect={agent=> {
                    if (agentType !== agent) {
                        setAgentType(agent);
                        loadLevel(levelId, agent);
                    }
                }}/>

            </ButtonToolbar>

            <SokobanGrid data={levelData}/>

            <SokobanStepperControls 
                disableNext={agentType === AgentType.MANUAL}
                currentIndex={solutionIndex}
                solutionLength={solutionData.length}
                onNext={() => loadNextState(solutionIndex + 1, solutionData)}
                onUndo={() => loadNextState(solutionIndex - 1, solutionData)}
            />
        </Container>
    );
}

export default Sokoban;