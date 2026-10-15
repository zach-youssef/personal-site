package com.zyoussef.Sokoban

import com.zyoussef.Models.Sokoban.SokobanLevelId
import com.zyoussef.Models.Sokoban.SokobanMove
import com.zyoussef.Sokoban.SokobanTestLevels.level
import com.zyoussef.Sokoban.SokobanTestLevels.corridor
import com.zyoussef.Sokoban.SokobanTestLevels.state
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class StateTest {
    @Test
    fun `constructor records player, boxes, spots and walls`() {
        val s = state(
            "#####",
            "#@$.#",
            "#?% #",
            "#####",
        )

        // A level can only have one player; the last one parsed wins
        assertEquals(Pair(2, 2), s.player)
        assertEquals(setOf(Pair(1, 2), Pair(2, 1)), s.boxes)
        assertEquals(setOf(Pair(1, 3), Pair(2, 1), Pair(2, 2)), s.spots)
        assertEquals(14, s.walls.size)
    }

    @Test
    fun `moving into an empty square only moves the player`() {
        val s = corridor("#@ #")
        val next = assertNotNull(s.getSuccessor(SokobanMove.RIGHT))

        assertEquals(Pair(1, 2), next.player)
        assertEquals(Pair(1, 1), s.player, "Original state must not be mutated")
    }

    @Test
    fun `moving into a wall is illegal`() {
        assertNull(corridor("#@ #").getSuccessor(SokobanMove.LEFT))
    }

    @Test
    fun `moving off the edge of the grid is illegal`() {
        // No spots, so this level doesn't need to be enclosed
        val s = state("@ ")
        assertNull(s.getSuccessor(SokobanMove.LEFT))
        assertNull(s.getSuccessor(SokobanMove.UP))
        assertNull(s.getSuccessor(SokobanMove.DOWN))
        assertNotNull(s.getSuccessor(SokobanMove.RIGHT))
    }

    @Test
    fun `pushing a box moves both the box and the player`() {
        val s = corridor("#@$ .#")
        val next = assertNotNull(s.getSuccessor(SokobanMove.RIGHT))

        assertEquals(Pair(1, 2), next.player)
        assertEquals(setOf(Pair(1, 3)), next.boxes)
        assertEquals(setOf(Pair(1, 2)), s.boxes, "Original state must not be mutated")
    }

    @Test
    fun `a box cannot be pushed into a wall or another box`() {
        assertNull(corridor("#@$#").getSuccessor(SokobanMove.RIGHT))
        assertNull(corridor("#@$$ #").getSuccessor(SokobanMove.RIGHT))
    }

    @Test
    fun `legal actions match the non-null successors`() {
        val s = state(
            "#####",
            "# @$#",
            "#####",
        )
        assertEquals(listOf(SokobanMove.LEFT), s.getLegalActions())
        assertEquals(setOf(SokobanMove.LEFT), s.getSuccessors().keys)
    }

    @Test
    fun `goal state requires every box to be on a spot`() {
        assertFalse(corridor("#@$.#").isGoalState())
        assertTrue(corridor("#@ ?#").isGoalState())
        assertTrue(corridor("#@  #").isGoalState(), "A level with no boxes is trivially solved")
    }

    @Test
    fun `a box pushed into a dead corner makes the state unsolvable`() {
        val s = state(
            "#####",
            "#  .#",
            "# $ #",
            "#@  #",
            "#####",
        )
        assertTrue(s.isSolvable())

        // Push the box left into column 1; it can never reach the spot from there
        val stuck = SokobanTestLevels.applyMoves(s, listOf(SokobanMove.RIGHT, SokobanMove.RIGHT, SokobanMove.UP, SokobanMove.LEFT))
        assertEquals(setOf(Pair(2, 1)), stuck.boxes)
        assertFalse(stuck.isSolvable())
    }

    @Test
    fun `states with the same layout are equal and hash equally`() {
        val a = corridor("#@ $ .#")
        val b = corridor("#@ $ .#")
        assertEquals(a, b)
        assertEquals(a.hashCode(), b.hashCode())

        val moved = assertNotNull(a.getSuccessor(SokobanMove.RIGHT))
        assertNotEquals(a, moved)
        assertEquals(a, assertNotNull(moved.getSuccessor(SokobanMove.LEFT)))
    }

    @Test
    fun `asLevel and toString round trip the original layout`() {
        val lines = arrayOf(
            "#######",
            "#.@$ ?#",
            "# %   #",
            "#######",
        )
        // PLAYER_ON_SPOT and PLAYER can't coexist, so check each separately
        val withPlayer = arrayOf(lines[0], lines[1], "#     #", lines[3])
        val withPlayerOnSpot = arrayOf(lines[0], "#. $ ?#", lines[2], lines[3])

        for (layout in listOf(withPlayer, withPlayerOnSpot)) {
            val original = level(*layout, id = SokobanLevelId.LEVEL_2)
            assertEquals(original, State(original).asLevel(SokobanLevelId.LEVEL_2))
            assertEquals(layout.joinToString("") { "$it\n" }, State(original).toString())
        }
    }

    @Test
    fun `newPos moves one square in the requested direction`() {
        val origin = Pair(5, 5)
        assertEquals(Pair(4, 5), State.newPos(SokobanMove.UP, origin))
        assertEquals(Pair(6, 5), State.newPos(SokobanMove.DOWN, origin))
        assertEquals(Pair(5, 4), State.newPos(SokobanMove.LEFT, origin))
        assertEquals(Pair(5, 6), State.newPos(SokobanMove.RIGHT, origin))
    }

    @Test
    fun `opposite reverses every direction`() {
        assertEquals(SokobanMove.DOWN, State.opposite(SokobanMove.UP))
        assertEquals(SokobanMove.UP, State.opposite(SokobanMove.DOWN))
        assertEquals(SokobanMove.RIGHT, State.opposite(SokobanMove.LEFT))
        assertEquals(SokobanMove.LEFT, State.opposite(SokobanMove.RIGHT))
        for (dir in SokobanMove.values()) {
            assertEquals(Pair(5, 5), State.newPos(State.opposite(dir), State.newPos(dir, Pair(5, 5))))
        }
    }
}
