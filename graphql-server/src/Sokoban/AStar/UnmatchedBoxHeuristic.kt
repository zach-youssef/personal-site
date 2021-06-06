package com.zyoussef.Sokoban.AStar

import com.zyoussef.Sokoban.State

class UnmatchedBoxHeuristic : IHeuristic {
    override fun apply(state: State): Int {
        return state.boxes.count { box -> !state.spots.contains(box) }
    }
}