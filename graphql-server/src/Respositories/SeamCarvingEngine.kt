package com.zyoussef.Respositories

import SeamCarving.FromFileImage
import SeamCarving.SeamCarver
import SeamCarving.SeamCarverAPI
import SeamCarving.WorldImage
import java.io.File
import java.io.IOException
import javax.imageio.ImageIO

// The original SeamCarving Java. Nothing is cached: every carve is the caller's to keep or delete.
class SeamCarvingEngine : ISeamCarvingRepository {
    val carver: SeamCarverAPI = SeamCarver()

    override fun carve(image: File, targetWidth: Int, targetHeight: Int, output: File): Boolean {
        var outputImage: WorldImage? = null

        try {
            outputImage = carver.carve(FromFileImage(image.absolutePath), targetWidth, targetHeight)
        } catch (e: Exception) {
            System.err.println(e.message)
        }

        if (outputImage == null) {
            return false
        }

        // Not WorldImage.saveImage, which logs and swallows write failures
        return try {
            ImageIO.write(outputImage.image, "png", output)
        } catch (e: IOException) {
            System.err.println(e.message)
            false
        }
    }
}
