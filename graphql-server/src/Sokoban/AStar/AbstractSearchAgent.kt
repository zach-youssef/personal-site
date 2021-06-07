package com.zyoussef.Sokoban.AStar

import com.zyoussef.Models.Sokoban.SokobanMove
import com.zyoussef.Sokoban.State
import java.util.*
import kotlin.collections.HashSet

abstract class AbstractSearchAgent : ISearchAgent {

    override fun solve(state: State): List<SokobanMove> {
        val frontier = getEmptyFrontier()
        frontier.push(state, LinkedList(), applyHeuristic(state))
        return solve(frontier, HashSet())
    }

    protected abstract fun getEmptyFrontier(): IFrontier

    protected abstract fun getHeuristic(): IHeuristic

    private fun applyHeuristic(state: State): Int {
        return getHeuristic().apply(state)
    }

    private fun solve(frontier: IFrontier, explored: HashSet<State>): List<SokobanMove> {
        while(!frontier.isEmpty()) {
            val curPair = frontier.pop()
            val currentState = curPair.first
            val currentPath = curPair.second

            if (explored.contains(currentState) || !currentState.isSolvable()) {
                continue;
            }

            explored.add(currentState)

            if (currentState.isGoalState()) {
                return currentPath
            }

            currentState.getSuccessors().forEach { succ ->
                val newState = succ.value
                val dir = succ.key
                if (!explored.contains(newState)) {
                    val newPath = LinkedList(currentPath)
                    newPath.add(dir)
                    frontier.push(newState, newPath, applyHeuristic(newState))
                }
            }
        }

        return emptyList()
    }
}