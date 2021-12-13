import React, { useState } from 'react';
import { Container,  ButtonToolbar } from 'react-bootstrap';
import { fetchGraphQL } from '../../FetchHelper';
import SokobanGrid from './SokobanGrid';
import { SquareType } from './SokobanSquare';
import SokobanStepperControls from './SokobanStepperControls';
import { GetStateAfterActionsQuery, GetLevelAndSolutionQuery } from '././../../graphql/SokobanQuieries'
import LevelSelector from './dropdowns/LevelSelector';
import AgentSelector from './dropdowns/AgentSelect';

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

    function loadNextState(index: number) {
        fetchGraphQL(GetStateAfterActionsQuery, {
            "level" : levelId,
            "actions" : solutionData.filter((_, idx) => idx < index)
        }).then(response => {
            const sokobanLevel: SokobanLevel = response.data.levelAfterActions
            setLevelData(sokobanLevel.level.map(row => row.row.map(square => forceMapSquare(square))))
            setSolutionIndex(index)
        }).catch(console.log)
    }
    
    function loadLevel(levelId: any) {
        setLevelData([]) // Clear existing data to show loading screen
        fetchGraphQL(GetLevelAndSolutionQuery, {
            "level": levelId
        }).then(response => {
            const sokobanLevel: SokobanLevel = response.data.sokobanLevel
            setLevelData(sokobanLevel.level.map(row => row.row.map(square => forceMapSquare(square))))
            
            const aiMoves: Move[] = response.data.aStarSolution
            setSolutionData(aiMoves)
            setSolutionIndex(0)
        }).catch(console.log);
    }

    return (
        <Container>
            <ButtonToolbar>

                <LevelSelector 
                  onLevelSelect={id => {
                      if (id !== levelId) {
                        setLevelId(id);
                        loadLevel(id)
                      }
                  }}
                />

                <AgentSelector />

            </ButtonToolbar>

            <SokobanGrid data={levelData}/>

            <SokobanStepperControls 
                currentIndex={solutionIndex}
                solutionLength={solutionData.length}
                onNext={() => loadNextState(solutionIndex + 1)}
                onUndo={() => loadNextState(solutionIndex - 1)}
            />
        </Container>
    );
}

export default Sokoban;