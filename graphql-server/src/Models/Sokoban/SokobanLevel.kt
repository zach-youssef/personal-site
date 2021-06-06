package com.zyoussef.Models.Sokoban

data class SokobanLevel(val id: SokobanLevelId, val level: List<SokobanRow>)

data class SokobanRow(val row: List<SokobanSquare>)
