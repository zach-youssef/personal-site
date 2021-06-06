package com.zyoussef.Sokoban.AStar

import com.zyoussef.Models.Sokoban.SokobanMove
import com.zyoussef.Sokoban.State

interface ISearchAgent {
    fun solve(state: State): List<SokobanMove>
}