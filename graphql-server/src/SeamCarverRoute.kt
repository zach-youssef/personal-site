package com.zyoussef

import com.zyoussef.Respositories.ISeamCarvingRepository
import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.util.cio.*
import io.ktor.utils.io.*
import java.io.File

// The seam carver page's endpoint: carves an uploaded image ("file") to the target "width" and
// "height". Uploads are written to uploadDir (the system's temporary directory if null) while
// they're carved.
internal fun Route.seamCarverUpload(seamCarvingRepository: ISeamCarvingRepository, uploadDir: File?) {
    post("/seamCarver/upload") {
        // No size limit, as before Ktor 3, which caps every part at 50 MiB by default. The file is
        // streamed to disk, so only carving holds the image in memory (and runs out of it below).
        val multiPartData = call.receiveMultipart(formFieldLimit = Long.MAX_VALUE)
        var imageFile: File? = null
        var targetWidth: Int? = null
        var targetHeight: Int? = null
        try {
            // Parse form data
            multiPartData.forEachPart { part ->
                try {
                    when (part) {
                        is PartData.FormItem -> {
                            when (part.name) {
                                "width" -> targetWidth = Integer.parseInt(part.value)
                                "height" -> targetHeight = Integer.parseInt(part.value)
                            }
                        }
                        is PartData.FileItem -> {
                            // A file per request, so concurrent uploads can't overwrite each other
                            val file = File.createTempFile("seamcarver-upload", ".png", uploadDir)
                            imageFile?.delete()
                            imageFile = file
                            part.provider().copyAndClose(file.writeChannel())
                        }
                        else -> {}
                    }
                } finally {
                    // Releases what the part holds, such as a temporary file of Ktor's
                    part.release()
                }
            }

            // Carve the image and return the output file
            val image = imageFile
            val width = targetWidth
            val height = targetHeight
            if (image != null && width != null && height != null) {
                try {
                    val carved = seamCarvingRepository.carve(image, width, height)
                    if (carved != null) {
                        call.respondFile(carved)
                    } else {
                        call.respondText("Unknown error ocurred", status = HttpStatusCode(500, "Internal server error"))
                    }
                } catch (e: OutOfMemoryError) {
                    call.respondText("Ran out of memory, try a smaller image", status = HttpStatusCode(413, "Input image too large"))
                }
            }
        } finally {
            imageFile?.delete()
        }
    }
}
