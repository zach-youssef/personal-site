package com.zyoussef.Respositories

import com.zyoussef.Models.Sokoban.SokobanLevel
import com.zyoussef.Models.Sokoban.SokobanLevelId
import com.zyoussef.Models.Sokoban.SokobanMove

class SokobanEngine : ISokobanRepository {
    override fun solveAStar(levelId: SokobanLevelId): List<SokobanMove> {
        //TODO("Not yet implemented")
        return emptyList()
    }

    override fun solveQAgent(levelId: SokobanLevelId): List<SokobanMove> {
        //TODO("Not yet implemented")
        return emptyList()
    }

    override fun getLevel(levelId: SokobanLevelId): SokobanLevel {
        //TODO("Not yet implemented")
        return SokobanLevel(SokobanLevelId.LEVEL_1, emptyList())
    }

    override fun getAvailableLevels(): List<SokobanLevelId> {
        //TODO("Not yet implemented")
        return emptyList()
    }
}