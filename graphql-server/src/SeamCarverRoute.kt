package com.zyoussef

import com.zyoussef.Respositories.ISeamCarvingRepository
import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.application.*
import io.ktor.server.application.hooks.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.util.*
import io.ktor.utils.io.*
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import javax.imageio.ImageIO
import kotlin.time.Duration
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.DelicateCoroutinesApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.supervisorScope
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

// The upload's limits, decided in the site's seam carver plan (S21, decision U): the image file may
// be up to 1 MiB, and up to 96,048 pixels (about 310 x 310), which the original Java's ~3.4 KB per
// pixel fits in the server's 400 MB heap (server-restart) next to everything else it serves.
internal const val SEAM_CARVER_MAX_FILE_BYTES = 1024L * 1024
internal const val SEAM_CARVER_MAX_PIXELS = 96_048L

// The whole request body may hold the file and the form's other fields and boundaries besides
internal const val SEAM_CARVER_MAX_BODY_BYTES = SEAM_CARVER_MAX_FILE_BYTES + 16 * 1024

internal const val SEAM_CARVER_TOO_LARGE_MESSAGE = "Image file too large (max 1 MB)"

// Set on a call whose body went over SEAM_CARVER_MAX_BODY_BYTES
private val BodyCutOff = AttributeKey<Unit>("SeamCarverUploadBodyCutOff")

// Caps the bytes the route's handler can read from the body, whether or not the request gave its
// length (a chunked body has none): the body is cut off there, as if it ended, and the call marked,
// so the handler answers 413 once the multipart parser, which takes a missing closing boundary as
// the end, is done. Ktor's RequestBodyLimit plugin would cap it too, but it refuses a Content-Length
// over the limit before the handler runs, with an empty 413, so the page couldn't show why.
@OptIn(DelicateCoroutinesApi::class)
private val UploadBodyLimit = createRouteScopedPlugin("SeamCarverUploadBodyLimit") {
    on(ReceiveRequestBytes) { call, body ->
        // Not in the call's scope, so that a failed read fails only what reads the channel. It ends
        // once the body ends, at the limit, or when the reader cancels the channel it writes to.
        GlobalScope.writer {
            val buffer = ByteArray(8192)
            var total = 0L
            while (true) {
                val read = body.readAvailable(buffer)
                if (read < 0) break
                total += read
                if (total > SEAM_CARVER_MAX_BODY_BYTES) {
                    call.attributes.put(BodyCutOff, Unit)
                    return@writer
                }
                channel.writeFully(buffer, 0, read)
            }
            body.closedCause?.let { throw it }
        }.channel
    }
}

private class BadUpload(val status: HttpStatusCode, message: String) : Exception(message)

private fun tooLarge(): Nothing = throw BadUpload(HttpStatusCode.PayloadTooLarge, SEAM_CARVER_TOO_LARGE_MESSAGE)

private fun badRequest(message: String): Nothing = throw BadUpload(HttpStatusCode.BadRequest, message)

// A failure of the server's own while it stores the upload (an unwritable temporary directory, a
// full disk), as opposed to the IOExceptions of a malformed body
private class StorageFailure(cause: IOException) : Exception(cause)

private inline fun <T> storing(block: () -> T): T = try {
    block()
} catch (e: IOException) {
    throw StorageFailure(e)
}

// Writes the part to file and closes it before returning. Its own loop, rather than copyAndClose
// into File.writeChannel(), so that a failure to write the file is told apart (as StorageFailure)
// from a failure to read the body.
internal suspend fun ByteReadChannel.copyToFile(file: File) = withContext(Dispatchers.IO) {
    val out = storing { FileOutputStream(file) }
    try {
        val buffer = ByteArray(8192)
        while (true) {
            val read = readAvailable(buffer)
            if (read < 0) break
            storing { out.write(buffer, 0, read) }
        }
    } catch (e: Throwable) {
        // The failure that stopped the copy is the one to report, not the close's
        runCatching { out.close() }
        throw e
    }
    storing { out.close() }
}

// The image's size from its header alone, so that a small file claiming a huge image (a
// decompression bomb) is refused before anything decodes its pixels; null if ImageIO can't read it.
// Some of ImageIO's readers throw more than IOExceptions on a malformed header.
private fun imageSize(file: File): Pair<Int, Int>? = try {
    ImageIO.createImageInputStream(file)?.use { stream ->
        val reader = ImageIO.getImageReaders(stream).asSequence().firstOrNull() ?: return null
        try {
            reader.input = stream
            reader.getWidth(0) to reader.getHeight(0)
        } finally {
            reader.dispose()
        }
    }
} catch (e: Exception) {
    null
}

// A target dimension: a whole number from 1 to the image's
private fun target(name: String, value: String?, max: Int): Int {
    if (value == null) badRequest("Missing $name")
    val parsed = value.trim().toIntOrNull()
    if (parsed == null || parsed < 1 || parsed > max) {
        badRequest("The $name must be a whole number from 1 to the image's $name, $max")
    }
    return parsed
}

// Takes a permit if one comes free within timeout. Not withTimeoutOrNull { acquire() } == null: the
// timeout can fire after acquire() has returned, which would report a permit it took as not taken,
// and leak it (every later upload then busy). Once acquire() returns, nothing suspends before the
// flag is set; cancelled before that, acquire() gives back the permit itself. A caller cancelled
// after it (the client gone) gets the CancellationException instead of the result, so the permit
// is given back here.
internal suspend fun Semaphore.acquireWithin(timeout: Duration): Boolean {
    var acquired = false
    try {
        withTimeoutOrNull(timeout) {
            acquire()
            acquired = true
        }
    } catch (e: CancellationException) {
        if (acquired) release()
        throw e
    }
    return acquired
}

// The seam carver page's endpoint: carves an uploaded image ("file") to the target "width" and
// "height", each from 1 to the image's, and answers the PNG. The upload and the carved image are
// written to uploadDir (the system's temporary directory if null) while they're carved, and deleted
// however the request ends. Refusals are plain text, which the page shows: 413 for a file over the
// limits, 400 for anything else wrong with the upload.
//
// One image is carved at a time, since one carve can take most of the heap: a request that finds
// another carving waits up to busyWait for it to end, then gets 503 "Busy, try again".
internal fun Route.seamCarverUpload(seamCarvingRepository: ISeamCarvingRepository, uploadDir: File?, busyWait: Duration) {
    val carving = Semaphore(1)
    route("/seamCarver/upload") {
        install(UploadBodyLimit)
        post {
            var imageFile: File? = null
            var outputFile: File? = null
            try {
                // Refused before reading anything when the request says how long it is
                val length = call.request.contentLength()
                if (length != null && length > SEAM_CARVER_MAX_BODY_BYTES) tooLarge()
                val type = try {
                    call.request.contentType()
                } catch (e: BadContentTypeFormatException) {
                    null
                }
                if (type == null || !type.match(ContentType.MultiPart.FormData)) {
                    throw BadUpload(HttpStatusCode.UnsupportedMediaType, "Expected a multipart/form-data upload")
                }

                var width: String? = null
                var height: String? = null
                // The parser runs in a coroutine of the scope it's received in; in a supervisor scope its
                // failure on a malformed body reaches the reader below, rather than cancelling the call
                // before it can answer
                try {
                    supervisorScope {
                        // Fields and files alike, so no part can be longer than the whole body
                        call.receiveMultipart(formFieldLimit = SEAM_CARVER_MAX_BODY_BYTES).forEachPart { part ->
                            try {
                                when (part) {
                                    is PartData.FormItem -> when (part.name) {
                                        "width" -> width = part.value
                                        "height" -> height = part.value
                                    }
                                    is PartData.FileItem -> {
                                        // A file per request, so concurrent uploads can't overwrite each
                                        // other; a second file replaces the first
                                        val file = storing { File.createTempFile("seamcarver-upload", ".png", uploadDir) }
                                        imageFile?.delete()
                                        imageFile = file
                                        part.provider().copyToFile(file)
                                    }
                                    else -> {}
                                }
                            } finally {
                                // Releases what the part holds, such as a temporary file of Ktor's
                                part.release()
                            }
                        }
                    }
                } catch (e: IOException) {
                    if (BodyCutOff in call.attributes) tooLarge()
                    badRequest("Malformed upload")
                }
                if (BodyCutOff in call.attributes) tooLarge()

                val image = imageFile ?: badRequest("Missing the image file")
                if (image.length() > SEAM_CARVER_MAX_FILE_BYTES) tooLarge()
                val (imageWidth, imageHeight) = imageSize(image) ?: badRequest("Not an image this server can read")
                if (imageWidth.toLong() * imageHeight > SEAM_CARVER_MAX_PIXELS) {
                    throw BadUpload(
                        HttpStatusCode.PayloadTooLarge,
                        "This image is $imageWidth x $imageHeight px, too large to carve: the most it takes is " +
                            "${"%,d".format(SEAM_CARVER_MAX_PIXELS)} pixels, about 310 x 310 px.",
                    )
                }
                val targetWidth = target("width", width, imageWidth)
                val targetHeight = target("height", height, imageHeight)

                // Carved to a temporary file, sent and deleted: nothing is kept, so no visitor's image
                // stays reachable on the server
                val output = storing { File.createTempFile("seamcarver-output", ".png", uploadDir) }
                outputFile = output
                if (!carving.acquireWithin(busyWait)) {
                    throw BadUpload(HttpStatusCode.ServiceUnavailable, "Busy, try again")
                }
                val carved = try {
                    // Off the request threads: carving blocks for seconds
                    withContext(Dispatchers.IO) {
                        seamCarvingRepository.carve(image, targetWidth, targetHeight, output)
                    }
                } catch (e: OutOfMemoryError) {
                    throw BadUpload(HttpStatusCode.PayloadTooLarge, "Ran out of memory, try a smaller image")
                } finally {
                    carving.release()
                }
                if (carved) {
                    // Read whole (it's at most SEAM_CARVER_MAX_PIXELS pixels), so the file can be
                    // deleted as soon as the response is made
                    call.respondBytes(storing { output.readBytes() }, ContentType.Image.PNG)
                } else {
                    call.respondText("The image couldn't be carved", status = HttpStatusCode.InternalServerError)
                }
            } catch (e: BadUpload) {
                call.respondText(e.message!!, status = e.status)
            } catch (e: StorageFailure) {
                call.application.log.error("Couldn't store a seam carver upload", e.cause)
                call.respondText("The server couldn't store the upload", status = HttpStatusCode.InternalServerError)
            } finally {
                imageFile?.delete()
                outputFile?.delete()
            }
        }
    }
}
