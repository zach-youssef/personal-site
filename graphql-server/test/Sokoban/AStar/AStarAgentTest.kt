package com.zyoussef.Sokoban.AStar

import com.zyoussef.Models.Sokoban.SokobanLevelId
import com.zyoussef.Models.Sokoban.SokobanMove
import com.zyoussef.Sokoban.SokobanParser
import com.zyoussef.Sokoban.SokobanTestLevels.applyMoves
import com.zyoussef.Sokoban.SokobanTestLevels.corridor
import com.zyoussef.Sokoban.SokobanTestLevels.state
import com.zyoussef.Sokoban.State
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AStarAgentTest {
    private val agent = AStarAgent(UnmatchedBoxHeuristic())

    @Test
    fun `finds the shortest solution to a straight corridor`() {
        assertEquals(
            listOf(SokobanMove.RIGHT, SokobanMove.RIGHT, SokobanMove.RIGHT),
            agent.solve(corridor("#@ $ .#")),
        )
    }

    @Test
    fun `returns no moves for an already solved level`() {
        assertEquals(emptyList(), agent.solve(corridor("#@ ?#")))
    }

    @Test
    fun `returns no moves for an unsolvable level`() {
        // The box is against the top wall and the spot is below it
        val unsolvable = state(
            "#####",
            "# $ #",
            "#@ .#",
            "#####",
        )
        assertEquals(emptyList(), agent.solve(unsolvable))
    }

    @Test
    fun `solves every bundled level`() {
        for (id in SokobanLevelId.values()) {
            val start = State(SokobanParser.loadLevel(id))
            val moves = agent.solve(start)

            assertTrue(moves.isNotEmpty(), "$id should need at least one move")
            assertTrue(applyMoves(start, moves).isGoalState(), "$id solution should reach the goal")
        }
    }
}

class UnmatchedBoxHeuristicTest {
    @Test
    fun `counts boxes that are not on spots`() {
        val heuristic = UnmatchedBoxHeuristic()
        assertEquals(0, heuristic.apply(corridor("#@ ?#")))
        assertEquals(1, heuristic.apply(corridor("#@$?.#")))
        assertEquals(2, heuristic.apply(corridor("#@$$..?#")))
    }
}

class PriorityQueueFrontierTest {
    @Test
    fun `pops in order of heuristic plus path length`() {
        val frontier = PriorityQueueFrontier()
        val a = corridor("#@  #")
        val b = corridor("# @ #")
        val c = corridor("#  @#")

        // Priorities: a = 5 + 0, b = 1 + 2, c = 2 + 0
        frontier.push(a, emptyList(), 5)
        frontier.push(b, listOf(SokobanMove.LEFT, SokobanMove.RIGHT), 1)
        frontier.push(c, emptyList(), 2)

        assertEquals(c, frontier.pop().first)
        val (state, path) = frontier.pop()
        assertEquals(b, state)
        assertEquals(listOf(SokobanMove.LEFT, SokobanMove.RIGHT), path)
        assertEquals(a, frontier.pop().first)
        assertTrue(frontier.isEmpty())
    }
}
