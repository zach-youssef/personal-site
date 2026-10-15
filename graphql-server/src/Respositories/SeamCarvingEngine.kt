package com.zyoussef.Respositories

import SeamCarving.FromFileImage
import SeamCarving.SeamCarver
import SeamCarving.SeamCarverAPI
import SeamCarving.WorldImage
import java.io.File
import java.nio.file.Files
import java.security.MessageDigest

// Carved images are cached in outputDir, keyed by the input's content and the target size
class SeamCarvingEngine(private val outputDir: File) : ISeamCarvingRepository {
    val carver: SeamCarverAPI = SeamCarver()

    override fun carve(image: File, targetWidth: Int, targetHeight: Int): File? {
        val output = File(outputDir, "${sha256(image)}-$targetWidth-$targetHeight.png")
        if (output.exists()) {
            return output
        }

        var outputImage: WorldImage? = null

        try{

            outputImage = carver.carve(FromFileImage(image.absolutePath), targetWidth, targetHeight)

        } catch (e: Exception) { System.err.println(e.message) }

        if (outputImage == null) {
            return null;
        }

        outputImage.saveImage(output.path);
        return output
    }

    companion object{
        private fun sha256(file: File): String {
            val hash: ByteArray = MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(file.toPath()))
            return hash.joinToString("") { "%02x".format(it) }
        }
    }
}
