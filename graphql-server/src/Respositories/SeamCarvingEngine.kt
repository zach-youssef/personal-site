package com.zyoussef.Respositories

import SeamCarving.FromFileImage
import SeamCarving.SeamCarver
import SeamCarving.SeamCarverAPI
import SeamCarving.WorldImage
import java.io.File
import java.nio.file.Files
import java.security.MessageDigest

class SeamCarvingEngine() : ISeamCarvingRepository {
    val carver: SeamCarverAPI = SeamCarver()

    init {
        if (inputImageDB.isEmpty()) {
            val folder = File("assets/seamcarver/input")
            if (!folder.listFiles()?.filter{it.name != ".gitignore"}.isNullOrEmpty()){
                for (image in folder.listFiles()) {
                    val hash = sha256(image)
                    inputImageDB[hash] = image.absolutePath
                    println("Lodaded file ${image.absolutePath} with id $hash")
                }
            }
        }
    }

    override fun carveImage(imageId: String, targetWidth: Int, targetHeight: Int): String? {
        val outputPath = "assets/seamcarver/output/$imageId-$targetWidth-$targetHeight.png"

        // Check if this computation already exists
        if (File(outputPath).exists()){
            return "http://localhost:8080/$outputPath"
        }

        // Otherwise, load the image and carve it
        val inputImage = loadImageById(imageId);
        var outputImage: WorldImage? = null

        try{

            outputImage = carver.carve(inputImage, targetWidth, targetHeight)

        } catch (e: Exception) { System.err.println(e.message) }

        if (outputImage == null) {
            return null;
        }

        outputImage.saveImage(outputPath);
        return "http://localhost:8080/$outputPath"
    }

    // TODO create a database with mappings from hash to file
    private fun loadImageById(imageId: String): FromFileImage? {
        val fileLocation = inputImageDB[imageId]
        return if (fileLocation == null) null else FromFileImage(fileLocation)
    }

    companion object{

        // TODO in lieu of a database, this temporary solution stores a map of stored images to their hash
        // TODO It should be computed once on server startup, and updated when new images are uploaded
        // TODO this is a mapping from hash -> file location
        val inputImageDB: MutableMap<String, String> = mutableMapOf()

        private fun sha256(file: File): String {
            val hash: ByteArray = MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(file.toPath()))
            return hash.toString()
        }
    }
}