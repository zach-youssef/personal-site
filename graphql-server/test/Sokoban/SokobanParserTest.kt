package com.zyoussef.Sokoban

import com.zyoussef.Models.Sokoban.SokobanLevelId
import com.zyoussef.Models.Sokoban.SokobanSquare.*
import kotlin.test.Test
import kotlin.test.assertEquals

class SokobanParserTest {
    @Test
    fun `parses level 0 and ignores the byte order mark`() {
        val level = SokobanParser.loadLevel(SokobanLevelId.LEVEL_0)

        assertEquals(SokobanLevelId.LEVEL_0, level.id)
        assertEquals(
            listOf(
                List(7) { WALL },
                listOf(WALL, PLAYER, EMPTY, BOX, EMPTY, SPOT, WALL),
                List(7) { WALL },
            ),
            level.level.map { it.row },
        )
    }

    @Test
    fun `parses ragged rows and filled spots in level 2`() {
        val level = SokobanParser.loadLevel(SokobanLevelId.LEVEL_2)

        assertEquals(9, level.level.size)
        assertEquals(listOf(EMPTY, EMPTY, WALL, WALL, WALL, WALL, WALL), level.level[0].row)
        assertEquals(listOf(WALL, BOX, EMPTY, FILLED_SPOT, BOX, BOX, SPOT, WALL), level.level[6].row)
    }

    @Test
    fun `every level has one player and as many spots as boxes`() {
        for (id in SokobanLevelId.values()) {
            val squares = SokobanParser.loadLevel(id).level.flatMap { it.row }
            val players = squares.count { it == PLAYER || it == PLAYER_ON_SPOT }
            val boxes = squares.count { it == BOX || it == FILLED_SPOT }
            val spots = squares.count { it == SPOT || it == FILLED_SPOT || it == PLAYER_ON_SPOT }

            assertEquals(1, players, "$id player count")
            assertEquals(boxes, spots, "$id box/spot count")
        }
    }
}
