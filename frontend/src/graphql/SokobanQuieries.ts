export const GetStateAfterActionsQuery = `
    query GetStateAfterActionsQuery($level: SokobanLevelId!, $actions: [SokobanMove!]!) {
        levelAfterActions(levelId: $level, actions: $actions) {
            level {
                row
            }
        }
    }
`

export const GetLevelAndSolutionQuery = `
    query GetLevelAndSolutionQuery($level: SokobanLevelId!) {
        sokobanLevel(levelId: $level) {
            level {
                row
            }
        },
        aStarSolution(levelId: $level)
    }
`

export const GetAvailableLevelsQuery = `
    query GetAvailableLevelsQuery {
        levels
    }
`