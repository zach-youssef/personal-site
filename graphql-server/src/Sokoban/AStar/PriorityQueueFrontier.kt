package com.zyoussef.Sokoban.AStar

import com.zyoussef.Models.Sokoban.SokobanMove
import com.zyoussef.Sokoban.State
import java.util.*

class PriorityQueueFrontier() : IFrontier {
    private val queue: PriorityQueue<Triple<State, List<SokobanMove>, Int>> =
        PriorityQueue<Triple<State, List<SokobanMove>, Int>>{ t1, t2 -> t1.third.compareTo(t2.third) }


    override fun push(state: State, path: List<SokobanMove>, heuristicVal: Int) {
        queue.add(Triple(state, path, heuristicVal + path.count()))
    }

    override fun pop(): Pair<State, List<SokobanMove>> {
        val triple = queue.remove()
        return Pair(triple.first, triple.second)
    }

    override fun isEmpty(): Boolean {
        return queue.isEmpty()
    }
}