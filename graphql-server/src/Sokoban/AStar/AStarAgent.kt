package com.zyoussef.Sokoban.AStar

class AStarAgent(private val searchHeuristic: IHeuristic) : AbstractSearchAgent() {
    override fun getEmptyFrontier(): IFrontier {
        return PriorityQueueFrontier()
    }

    override fun getHeuristic(): IHeuristic {
        return this.searchHeuristic
    }
}