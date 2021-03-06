package com.zyoussef.Sokoban

import com.zyoussef.Models.Sokoban.SokobanLevel
import com.zyoussef.Models.Sokoban.SokobanLevelId
import com.zyoussef.Models.Sokoban.SokobanRow
import com.zyoussef.Models.Sokoban.SokobanSquare
import java.io.File

object SokobanParser {
    private val LEVEL_SRC = mapOf(
        SokobanLevelId.LEVEL_0 to "resources/sokobanLevels/level0.sokoban",
        SokobanLevelId.LEVEL_1 to "resources/sokobanLevels/level1.sokoban",
        SokobanLevelId.LEVEL_2 to "resources/sokobanLevels/level2.sokoban",
    )

    fun loadLevel(levelId: SokobanLevelId): SokobanLevel {
        return SokobanLevel(levelId,
            File(LEVEL_SRC[levelId]!!).readLines().map { line ->
                SokobanRow(line.filter{it in setOf(' ', '#', '.', '@', '?', '$', '%')}.map { char ->
                    when(char){
                        ' ' -> SokobanSquare.EMPTY
                        '#' -> SokobanSquare.WALL
                        '.' -> SokobanSquare.SPOT
                        '@' -> SokobanSquare.PLAYER
                        '?' -> SokobanSquare.FILLED_SPOT
                        '$' -> SokobanSquare.BOX
                        '%' -> SokobanSquare.PLAYER_ON_SPOT
                        else -> throw Exception(char.toString())
                    }
                })
            })
    }
}