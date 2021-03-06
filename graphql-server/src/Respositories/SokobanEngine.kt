package com.zyoussef.Respositories

import com.zyoussef.Models.Sokoban.SokobanLevel
import com.zyoussef.Models.Sokoban.SokobanLevelId
import com.zyoussef.Models.Sokoban.SokobanMove
import com.zyoussef.Sokoban.AStar.AStarAgent
import com.zyoussef.Sokoban.AStar.UnmatchedBoxHeuristic
import com.zyoussef.Sokoban.SokobanParser
import com.zyoussef.Sokoban.State

class SokobanEngine : ISokobanRepository {
    override fun solveAStar(levelId: SokobanLevelId): List<SokobanMove> {
        return AStarAgent(UnmatchedBoxHeuristic()).solve(State(loadLevel(levelId)))
    }

    override fun solveQAgent(levelId: SokobanLevelId): List<SokobanMove> {
        //TODO("Not yet implemented")
        return emptyList()
    }

    override fun getLevel(levelId: SokobanLevelId): SokobanLevel {
        return loadLevel(levelId)
    }

    override fun getAvailableLevels(): Array<SokobanLevelId> {
        return SokobanLevelId.values()
    }

    override fun getLevelAfterActions(levelId: SokobanLevelId, actions: List<SokobanMove>): SokobanLevel {
        return actions.fold(State(loadLevel(levelId))){ state: State, move: SokobanMove -> state.getSuccessor(move)!! }.asLevel(levelId)
    }

    companion object {
        // Cache levels we've already loaded into memory
        private val levels = mutableMapOf<SokobanLevelId, SokobanLevel>()

        fun loadLevel(levelId: SokobanLevelId): SokobanLevel {
            return levels.computeIfAbsent(levelId){ SokobanParser.loadLevel(it) }
        }
    }
}