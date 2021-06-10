package com.zyoussef.Respositories

import java.io.File

interface ISeamCarvingRepository {
    // Returns the url to the carved image
    fun carve(image: File, targetWidth: Int, targetHeight: Int): File?
}