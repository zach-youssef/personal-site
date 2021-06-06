package com.zyoussef.Sokoban.AStar

import com.zyoussef.Models.Sokoban.SokobanMove
import com.zyoussef.Sokoban.State

interface IFrontier {
    fun push(state: State, path: List<SokobanMove>, heuristicVal: Int)

    fun pop(): Pair<State, List<SokobanMove>>

    fun isEmpty(): Boolean
}