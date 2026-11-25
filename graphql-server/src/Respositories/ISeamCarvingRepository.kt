package com.zyoussef.Respositories

import java.io.File

interface ISeamCarvingRepository {
    // Carves the image to the target size and writes it to output as a PNG; false if it couldn't
    // (the image unreadable, or output unwritable)
    fun carve(image: File, targetWidth: Int, targetHeight: Int, output: File): Boolean
}
