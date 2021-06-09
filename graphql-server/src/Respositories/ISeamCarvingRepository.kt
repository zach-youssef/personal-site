package com.zyoussef.Respositories

interface ISeamCarvingRepository {
    // Returns the url to the carved image
    fun carveImage(imageId: String, targetWidth: Int, targetHeight: Int): String?
}