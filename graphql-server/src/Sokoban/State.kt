package com.zyoussef.Sokoban

import com.zyoussef.Models.Sokoban.*
import java.util.*
import kotlin.collections.HashSet

class State {
    val boxes: MutableSet<Pair<Int, Int>>
    val spots: MutableSet<Pair<Int, Int>>
    val walls: MutableSet<Pair<Int, Int>>

    private val validBoxPositions: MutableSet<Pair<Int,Int>>
    private val numRows: Int
    private val numCols: Int

    var player: Pair<Int, Int>

    constructor(level: SokobanLevel) {
        boxes = HashSet()
        spots = HashSet()
        walls = HashSet()
        validBoxPositions = HashSet()
        player = Pair(-1, -1)

        numRows = level.level.count()
        numCols = level.level.maxOf { row -> row.row.count() }

        NODES_EXPANDED = 0

        level.level.forEachIndexed { rowIndex, row ->
            row.row.forEachIndexed { colIndex, sokobanSquare ->
                val curPos = Pair(rowIndex, colIndex)
                when(sokobanSquare) {
                    SokobanSquare.EMPTY, SokobanSquare.UNKNOWN -> {}
                    SokobanSquare.WALL -> walls.add(curPos)
                    SokobanSquare.SPOT -> spots.add(curPos)
                    SokobanSquare.BOX -> boxes.add(curPos)
                    SokobanSquare.PLAYER -> player = curPos
                    SokobanSquare.FILLED_SPOT -> {
                        spots.add(curPos)
                        boxes.add(curPos)
                    }
                    SokobanSquare.PLAYER_ON_SPOT -> {
                        spots.add(curPos)
                        player = curPos
                    }
                }
            }
        }

        calcDeadSquares()
    }

    private constructor(copy: State){
        this.player = Pair(copy.player.first, copy.player.second)
        this.boxes = HashSet(copy.boxes)

        // Copy spots and walls by reference as these are never mutated
        this.spots = copy.spots
        this.walls = copy.walls
        this.validBoxPositions = copy.validBoxPositions

        this.numRows = copy.numRows
        this.numCols = copy.numCols
    }

    fun asLevel(id: SokobanLevelId): SokobanLevel {
        return SokobanLevel(id, (0 until numRows).map{ row ->
            SokobanRow((0 until numCols).map { col ->
                val pos = Pair(row, col)
                when {
                    pos in spots && pos in boxes -> SokobanSquare.FILLED_SPOT
                    pos in spots && player == pos -> SokobanSquare.PLAYER_ON_SPOT
                    player == pos -> SokobanSquare.PLAYER
                    pos in walls -> SokobanSquare.WALL
                    pos in spots -> SokobanSquare.SPOT
                    pos in boxes -> SokobanSquare.BOX
                    else -> SokobanSquare.EMPTY
                }
            })
        })
    }

    // Precalculate the box positions that cannot be part of the solution
    private fun calcDeadSquares() {
        val frontier: Queue<Pair<Int, Int>> = LinkedList()

        spots.forEach{ spot -> frontier.add(spot) }

        while (frontier.isNotEmpty()) {
            val valid = frontier.remove()
            if (validBoxPositions.contains(valid)) {
                continue;
            }
            validBoxPositions.add(valid)

            // Add all positions we could have pushed a box onto into this position onto the frontier
            SokobanMove.values().forEach { dir ->
                val pushedFrom = newPos(dir, valid)
                // Position the player would need to be in to push the box here
                val playerPos = newPos(dir, pushedFrom)
                if(!(walls.contains(playerPos) || walls.contains(pushedFrom)))
                {
                    frontier.add(pushedFrom)
                }
            }
        }
    }

    fun getSuccessors(): Map<SokobanMove, State> {
        val successors = SokobanMove.values()
            .map { dir -> dir to getSuccessor(dir) }
            .filter { (_, state) -> state != null}
            .map{ (dir, state) -> dir to state!!}
            .toMap()

        successors.forEach{_ -> NODES_EXPANDED++}

        return successors
    }

    fun getLegalActions(): List<SokobanMove> {
        return SokobanMove.values()
            .map { dir -> dir to getSuccessor(dir) }
            .filter { (_, state) -> state != null }
            .map { (dir, _) -> dir}
    }

    fun getSuccessor(dir: SokobanMove): State? {
        val newPos = newPos(dir, player)
        val newRow = newPos.first
        val newCol = newPos.second

        // Verify the position is on the grid
        if (newRow >= numRows || newCol >= numCols || newRow < 0 || newCol < 0 ){
            return null
        }
        // Verify we aren't walking into a wall
        if (walls.contains(newPos)){
            return null
        }

        // If there is no box on this spot, we can just move there
        if (!boxes.contains(newPos)){
            return justMovePlayer(newPos)
        }

        return if (canBoxBePushed(dir, newPos))
            pushBox(dir, newPos)
        else null
    }

    fun isGoalState(): Boolean {
        return boxes.all { box -> spots.contains(box) }
    }

    override fun toString(): String {
        val stringBuilder = StringBuilder()
        for(row: Int in 0 until numRows) {
            val line = StringBuilder()
            for (col: Int in 0 until numCols) {
                val pos = Pair(row, col)
                line.append(when {
                    pos in spots && pos in boxes -> "?"
                    pos in spots && pos == player -> "%"
                    player == pos -> "@"
                    pos in walls -> "#"
                    pos in spots -> "."
                    pos in boxes -> "$"
                    else -> " "
                })
            }
            stringBuilder.append(line.toString() + "\n")
        }
        return stringBuilder.toString()
    }

    fun isSolvable(): Boolean {
        return noBoxInDeadSpace() // && noBoxesFrozen()
    }

    private fun noBoxInDeadSpace(): Boolean {
        return boxes.all{ box -> validBoxPositions.contains(box) }
    }

    private fun noBoxesFrozen(): Boolean {
        return boxes.all { box -> spots.contains(box) || !isBoxFrozen(box, HashSet()) }
    }

    private fun isBoxFrozen(box: Pair<Int, Int>, seen: HashSet<Pair<Int, Int>>): Boolean{
        val frozenVert = isBoxSimplyFrozenOnAxis(box, SokobanMove.UP, seen)
        val frozenHoriz = isBoxSimplyFrozenOnAxis(box, SokobanMove.LEFT, seen)

        seen.add(box)

        if (frozenHoriz && frozenVert) {
            return true
        } else if (frozenHoriz) {
            return isBoxFrozenByBoxAxis(box, SokobanMove.UP, seen)
        } else if (frozenVert) {
            return isBoxFrozenByBoxAxis(box, SokobanMove.LEFT, seen)
        } else {
            return isBoxFrozenByBoxAxis(box, SokobanMove.UP, seen)
                    && isBoxFrozenByBoxAxis(box, SokobanMove.LEFT, seen)
        }
    }

    private fun isBoxFrozenByBoxAxis(box: Pair<Int, Int>, dir: SokobanMove, seen: HashSet<Pair<Int, Int>>): Boolean {
        val adjPos = listOf(newPos(dir, box), newPos(opposite(dir), box))

        return adjPos.any { pos -> boxes.contains(pos) && isBoxFrozen(pos, seen) }
    }

    private fun isBoxSimplyFrozenOnAxis(box: Pair<Int, Int>, dir: SokobanMove, seen: HashSet<Pair<Int, Int>>): Boolean {
        val adjPos = listOf(newPos(dir, box), newPos(opposite(dir), box))

        // We are frozen on this axis if either side is a wall or "seen" box
        if(adjPos.any{ pos -> walls.contains(pos) || seen.contains(pos) }){
            return true;
        }

        // We are frozen on this axis if there is a dead space on both sides
        return adjPos.none { pos -> validBoxPositions.contains(pos) }
    }

    override fun hashCode(): Int {
        return this.toString().hashCode()
    }

    override fun equals(other: Any?): Boolean {
        if(other !is State) {
            return false;
        }

        return this.player.first == other.player.first
                && this.player.second == other.player.second
                && this.boxes.all { box -> other.boxes.contains(box) }
                && this.boxes.count() == other.boxes.count()
                && this.walls.all{ wall -> other.walls.contains(wall) }
                && this.walls.count() == other.walls.count()
                && this.spots.all{ spot -> other.spots.contains(spot)}
                && this.spots.count() == other.spots.count()
    }

    private fun justMovePlayer(newPlayerPos: Pair<Int, Int>): State {
        val newState = State(this)
        newState.player = newPlayerPos
        return newState
    }

    private fun canBoxBePushed(dir: SokobanMove, pos: Pair<Int, Int>): Boolean {
        val newPos = newPos(dir, pos)
        return (!(boxes.contains(newPos) || walls.contains(newPos)))
    }

    private fun pushBox(dir: SokobanMove, pos: Pair<Int, Int>) : State {
        val newState = State(this)
        newState.player = pos
        val newBoxPos = newPos(dir, pos)
        newState.boxes.remove(pos)
        newState.boxes.add(newBoxPos)
        return newState
    }

    companion object {
        var NODES_EXPANDED: Int = 0

        fun newPos(dir: SokobanMove, pos: Pair<Int, Int>): Pair<Int, Int> {
            return when(dir){
                SokobanMove.UP -> Pair(pos.first -1, pos.second)
                SokobanMove.DOWN -> Pair(pos.first + 1, pos.second)
                SokobanMove.LEFT -> Pair(pos.first, pos.second -1)
                SokobanMove.RIGHT -> Pair(pos.first, pos.second + 1)
            }
        }

        fun opposite(dir: SokobanMove): SokobanMove {
            return when(dir){
                SokobanMove.UP -> SokobanMove.DOWN
                SokobanMove.DOWN -> SokobanMove.UP
                SokobanMove.LEFT -> SokobanMove.LEFT
                SokobanMove.RIGHT -> SokobanMove.RIGHT
            }
        }
    }
}