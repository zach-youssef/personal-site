package com.zyoussef.Sokoban

import com.zyoussef.Models.Sokoban.SokobanLevel
import com.zyoussef.Models.Sokoban.SokobanLevelId
import com.zyoussef.Models.Sokoban.SokobanRow
import com.zyoussef.Models.Sokoban.SokobanSquare
import java.io.File

object SokobanParser {
    private val LEVEL_SRC = mapOf(
        SokobanLevelId.LEVEL_1 to "resources/sokobanLevels/level1.sokoban" // TODO
    )

    fun loadLevel(levelId: SokobanLevelId): SokobanLevel {
        return SokobanLevel(levelId,
            File(LEVEL_SRC[levelId]!!).readLines().map { line ->
                SokobanRow(line.map { char ->
                    when(char){
                        ' ' -> SokobanSquare.EMPTY
                        '#' -> SokobanSquare.WALL
                        '.' -> SokobanSquare.SPOT
                        '@' -> SokobanSquare.PLAYER
                        '?' -> SokobanSquare.FILLED_SPOT
                        '$' -> SokobanSquare.BOX
                        else -> SokobanSquare.UNKNOWN
                    }
                })
            })
    }
}