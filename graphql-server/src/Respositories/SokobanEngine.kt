package com.zyoussef.Respositories

import com.zyoussef.Models.Sokoban.SokobanLevel
import com.zyoussef.Models.Sokoban.SokobanLevelId
import com.zyoussef.Models.Sokoban.SokobanMove
import com.zyoussef.Sokoban.AStar.AStarAgent
import com.zyoussef.Sokoban.AStar.UnmatchedBoxHeuristic
import com.zyoussef.Sokoban.SokobanParser
import com.zyoussef.Sokoban.State
import com.zyoussef.Sokoban.QLearnedResults
import java.util.concurrent.ConcurrentHashMap

class SokobanEngine : ISokobanRepository {
    override fun solveAStar(levelId: SokobanLevelId): List<SokobanMove> {
        return AStarAgent(UnmatchedBoxHeuristic()).solve(State(loadLevel(levelId)))
    }

    override fun solveQAgent(levelId: SokobanLevelId): List<SokobanMove> {
        return when(levelId) {
            SokobanLevelId.LEVEL_0 -> QLearnedResults.level0
            // For some reason the site has levels 1 & 2 swapped
            SokobanLevelId.LEVEL_2 -> QLearnedResults.level1
            SokobanLevelId.LEVEL_1 -> QLearnedResults.level2
        }
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
        // GraphQL resolves fields of a query concurrently, so the cache must be thread safe
        private val levels = ConcurrentHashMap<SokobanLevelId, SokobanLevel>()

        fun loadLevel(levelId: SokobanLevelId): SokobanLevel {
            return levels.computeIfAbsent(levelId){ SokobanParser.loadLevel(it) }
        }
    }
}