package com.zyoussef.Respositories

import com.zyoussef.Models.Sokoban.SokobanLevelId
import com.zyoussef.Models.Sokoban.SokobanMove
import com.zyoussef.Models.Sokoban.SokobanSquare
import com.zyoussef.Sokoban.SokobanParser
import com.zyoussef.Sokoban.SokobanTestLevels.applyMoves
import com.zyoussef.Sokoban.State
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class SokobanEngineTest {
    private val engine = SokobanEngine()

    @Test
    fun `lists every level id`() {
        assertEquals(SokobanLevelId.values().toList(), engine.getAvailableLevels().toList())
    }

    @Test
    fun `getLevel matches the parsed level file`() {
        for (id in SokobanLevelId.values()) {
            assertEquals(SokobanParser.loadLevel(id), engine.getLevel(id))
        }
    }

    @Test
    fun `level after no actions is the starting level`() {
        assertEquals(engine.getLevel(SokobanLevelId.LEVEL_0), engine.getLevelAfterActions(SokobanLevelId.LEVEL_0, emptyList()))
    }

    @Test
    fun `level after actions reflects pushed boxes`() {
        val after = engine.getLevelAfterActions(SokobanLevelId.LEVEL_0, listOf(SokobanMove.RIGHT, SokobanMove.RIGHT))
        assertEquals(
            listOf(SokobanSquare.WALL, SokobanSquare.EMPTY, SokobanSquare.EMPTY, SokobanSquare.PLAYER, SokobanSquare.BOX, SokobanSquare.SPOT, SokobanSquare.WALL),
            after.level[1].row,
        )
    }

    @Test
    fun `level after an illegal action fails`() {
        assertFailsWith<NullPointerException> {
            engine.getLevelAfterActions(SokobanLevelId.LEVEL_0, listOf(SokobanMove.UP))
        }
    }

    @Test
    fun `AStar solutions solve their levels`() {
        for (id in SokobanLevelId.values()) {
            val end = applyMoves(State(engine.getLevel(id)), engine.solveAStar(id))
            assertTrue(end.isGoalState(), "$id")
        }
    }

    @Test
    fun `Q learning solutions only contain legal moves`() {
        for (id in SokobanLevelId.values()) {
            applyMoves(State(engine.getLevel(id)), engine.solveQAgent(id))
        }
    }

    @Test
    fun `Q learning solutions solve the levels the agent converged on`() {
        // The recorded LEVEL_2 run hit the agent's move cap without solving the level
        for (id in listOf(SokobanLevelId.LEVEL_0, SokobanLevelId.LEVEL_1)) {
            val end = applyMoves(State(engine.getLevel(id)), engine.solveQAgent(id))
            assertTrue(end.isGoalState(), "$id")
        }
    }
}
