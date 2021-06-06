package com.zyoussef.Respositories

import com.zyoussef.Models.Sokoban.SokobanLevel
import com.zyoussef.Models.Sokoban.SokobanLevelId
import com.zyoussef.Models.Sokoban.SokobanMove

interface ISokobanRepository {
    fun solveAStar(levelId: SokobanLevelId): List<SokobanMove>

    fun solveQAgent(levelId: SokobanLevelId): List<SokobanMove>

    fun getLevel(levelId: SokobanLevelId): SokobanLevel

    fun getAvailableLevels(): List<SokobanLevelId>
}