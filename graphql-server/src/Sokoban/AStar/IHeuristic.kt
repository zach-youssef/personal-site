package com.zyoussef.Sokoban.AStar

import com.zyoussef.Sokoban.State

interface IHeuristic {
    fun apply(state: State): Int
}