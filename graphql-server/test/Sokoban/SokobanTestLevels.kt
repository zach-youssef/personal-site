package com.zyoussef.Sokoban

import com.zyoussef.Models.Sokoban.SokobanLevel
import com.zyoussef.Models.Sokoban.SokobanLevelId
import com.zyoussef.Models.Sokoban.SokobanMove
import com.zyoussef.Models.Sokoban.SokobanRow
import com.zyoussef.Models.Sokoban.SokobanSquare

// Builds levels inline using the same character set as the .sokoban level files
object SokobanTestLevels {
    fun level(vararg lines: String, id: SokobanLevelId = SokobanLevelId.LEVEL_0): SokobanLevel =
        SokobanLevel(id, lines.map { line -> SokobanRow(line.map(::square)) })

    fun state(vararg lines: String): State = State(level(*lines))

    // A single row level with walls above and below it
    fun corridor(line: String): State {
        val wall = "#".repeat(line.length)
        return state(wall, line, wall)
    }

    fun applyMoves(state: State, moves: List<SokobanMove>): State =
        moves.fold(state) { current, move ->
            current.getSuccessor(move) ?: throw AssertionError("Illegal move $move from\n$current")
        }

    private fun square(char: Char): SokobanSquare = when (char) {
        ' ' -> SokobanSquare.EMPTY
        '#' -> SokobanSquare.WALL
        '.' -> SokobanSquare.SPOT
        '@' -> SokobanSquare.PLAYER
        '?' -> SokobanSquare.FILLED_SPOT
        '$' -> SokobanSquare.BOX
        '%' -> SokobanSquare.PLAYER_ON_SPOT
        else -> throw IllegalArgumentException("Unknown square '$char'")
    }
}
