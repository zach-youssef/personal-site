package com.zyoussef

import com.zyoussef.Respositories.SeamCarvingEngine
import io.ktor.client.request.*
import io.ktor.client.request.forms.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.routing.*
import io.ktor.server.testing.*
import io.ktor.utils.io.*
import java.awt.Color
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.io.File
import java.nio.file.Files
import java.util.zip.CRC32
import java.util.zip.Deflater
import javax.imageio.ImageIO
import kotlinx.coroutines.runBlocking
import kotlin.concurrent.thread
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

// The upload route's limits and validation, on the real engine with a directory of its own for
// uploads and carved images, so every test can check that none is left behind
class SeamCarverRouteTest {
    private val dir = Files.createTempDirectory("seamcarver-route").toFile()
    private val uploadDir = File(dir, "uploads").apply { mkdirs() }

    @AfterTest
    fun cleanUp() {
        dir.deleteRecursively()
    }

    private fun withRoute(test: suspend ApplicationTestBuilder.() -> Unit) = testApplication {
        routing { seamCarverUpload(SeamCarvingEngine(), uploadDir) }
        test()
        assertEquals(emptyList(), uploadDir.list()!!.toList(), "uploads left behind")
    }

    // A 12x10 PNG to carve
    private fun testPng(): ByteArray {
        val input = BufferedImage(12, 10, BufferedImage.TYPE_INT_RGB)
        for (x in 0 until input.width) for (y in 0 until input.height) {
            input.setRGB(x, y, Color((x * 20) % 256, (y * 25) % 256, ((x + y) * 10) % 256).rgb)
        }
        return ByteArrayOutputStream().also { ImageIO.write(input, "png", it) }.toByteArray()
    }

    // A PNG of a few hundred bytes whose header claims width x height pixels (a decompression
    // bomb): its one row of data is all a decoder would find before it ran out
    private fun bombPng(width: Int, height: Int): ByteArray {
        val out = ByteArrayOutputStream()
        val data = DataOutputStream(out)
        fun chunk(type: String, body: ByteArray) {
            data.writeInt(body.size)
            val typed = type.toByteArray() + body
            data.write(typed)
            data.writeInt(CRC32().apply { update(typed) }.value.toInt())
        }
        data.write(byteArrayOf(0x89.toByte(), 'P'.code.toByte(), 'N'.code.toByte(), 'G'.code.toByte(), 13, 10, 26, 10))
        chunk("IHDR", ByteArrayOutputStream().also {
            DataOutputStream(it).apply {
                writeInt(width)
                writeInt(height)
                write(byteArrayOf(8, 2, 0, 0, 0)) // 8-bit RGB, no interlace
            }
        }.toByteArray())
        val row = ByteArray(1 + 3 * width)
        val deflated = ByteArray(row.size + 64)
        val length = Deflater().run {
            setInput(row)
            finish()
            deflate(deflated).also { end() }
        }
        chunk("IDAT", deflated.copyOf(length))
        chunk("IEND", ByteArray(0))
        return out.toByteArray()
    }

    private suspend fun ApplicationTestBuilder.upload(file: ByteArray?, vararg fields: Pair<String, String>) =
        client.submitFormWithBinaryData("/seamCarver/upload", formData {
            for ((name, value) in fields) append(name, value)
            if (file != null) {
                append("file", file, Headers.build {
                    append(HttpHeaders.ContentDisposition, "filename=\"test.png\"")
                    append(HttpHeaders.ContentType, ContentType.Image.PNG.toString())
                })
            }
        })

    private suspend fun HttpResponse.assertRefused(status: HttpStatusCode, message: String) {
        assertEquals(status, this.status, bodyAsText())
        assertTrue(contentType()!!.match(ContentType.Text.Plain), "${contentType()}")
        assertTrue(bodyAsText().contains(message), bodyAsText())
    }

    @Test
    fun `carves a valid upload to the requested size`() = withRoute {
        val call = upload(testPng(), "width" to "9", "height" to "7")

        assertEquals(HttpStatusCode.OK, call.status)
        val carved = assertNotNull(ImageIO.read(call.bodyAsBytes().inputStream()))
        assertEquals(9, carved.width)
        assertEquals(7, carved.height)
    }

    @Test
    fun `targets equal to the image's size and the smallest are accepted`() = withRoute {
        assertEquals(HttpStatusCode.OK, upload(testPng(), "width" to "12", "height" to "10").status)
        assertEquals(HttpStatusCode.OK, upload(testPng(), "width" to "1", "height" to "1").status)
    }

    @Test
    fun `a body over the limit is refused with 413 before it is read`() = withRoute {
        val call = upload(ByteArray(SEAM_CARVER_MAX_BODY_BYTES.toInt()), "width" to "9", "height" to "7")
        call.assertRefused(HttpStatusCode.PayloadTooLarge, SEAM_CARVER_TOO_LARGE_MESSAGE)
    }

    // Posts a multipart body of no stated length (chunked), written by write
    private suspend fun ApplicationTestBuilder.postStreamed(
        boundary: String,
        write: suspend ByteWriteChannel.() -> Unit,
    ): HttpResponse = client.post("/seamCarver/upload") {
        setBody(object : OutgoingContent.WriteChannelContent() {
            override val contentType = ContentType.MultiPart.FormData.withParameter("boundary", boundary)
            override val contentLength: Long? = null

            override suspend fun writeTo(channel: ByteWriteChannel) = channel.write()
        })
    }.also { assertEquals(null, it.request.headers[HttpHeaders.ContentLength]) }

    @Test
    fun `a body of no stated length is cut off at the limit with 413`() = withRoute {
        val boundary = "limit-test-boundary"
        val png = testPng()
        val call = postStreamed(boundary) {
            fun field(name: String) = "--$boundary\r\nContent-Disposition: form-data; name=\"$name\"\r\n\r\n"
            writeFully((field("width") + "9\r\n" + field("height") + "7\r\n").toByteArray())
            writeFully(
                ("--$boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.png\"\r\n" +
                    "Content-Type: image/png\r\n\r\n").toByteArray()
            )
            writeFully(png)
            // A small valid upload, then a field of twice the limit: only cutting the body off
            // tells it apart from a valid upload (the field is ignored) or a malformed one (the
            // field over the parser's limit)
            writeFully(("\r\n" + field("padding")).toByteArray())
            val piece = ByteArray(64 * 1024) { 'x'.code.toByte() }
            repeat((2 * SEAM_CARVER_MAX_BODY_BYTES / piece.size).toInt()) { writeFully(piece) }
            writeFully("\r\n--$boundary--\r\n".toByteArray())
        }
        call.assertRefused(HttpStatusCode.PayloadTooLarge, SEAM_CARVER_TOO_LARGE_MESSAGE)
    }

    @Test
    fun `a small body of no stated length is carved`() = withRoute {
        val boundary = "small-test-boundary"
        val png = testPng()
        val call = postStreamed(boundary) {
            fun field(name: String) = "--$boundary\r\nContent-Disposition: form-data; name=\"$name\"\r\n\r\n"
            writeFully((field("width") + "9\r\n" + field("height") + "7\r\n").toByteArray())
            writeFully(
                ("--$boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.png\"\r\n" +
                    "Content-Type: image/png\r\n\r\n").toByteArray()
            )
            writeFully(png)
            writeFully("\r\n--$boundary--\r\n".toByteArray())
        }
        assertEquals(HttpStatusCode.OK, call.status, call.bodyAsText())
    }

    @Test
    fun `a malformed multipart body is refused with 400`() = withRoute {
        // A part whose headers never end
        postStreamed("b") { writeFully("--b\r\nContent-Disposition: form-data; name=\"width\"".toByteArray()) }
            .assertRefused(HttpStatusCode.BadRequest, "Malformed upload")
    }

    @Test
    fun `a file of up to 1 MiB is read in full`() = withRoute {
        // Not an image, so it's refused, but for that rather than its size
        upload(ByteArray(SEAM_CARVER_MAX_FILE_BYTES.toInt()), "width" to "9", "height" to "7")
            .assertRefused(HttpStatusCode.BadRequest, "Not an image")
        upload(ByteArray(SEAM_CARVER_MAX_FILE_BYTES.toInt() + 1), "width" to "9", "height" to "7")
            .assertRefused(HttpStatusCode.PayloadTooLarge, SEAM_CARVER_TOO_LARGE_MESSAGE)
    }

    @Test
    fun `an upload is all written, and the file closed, when its copy returns`(): Unit = runBlocking {
        // A FIFO, whose opening for writing waits for a reader: a copy that went on writing the
        // file after it returned would return before the reader came, with nothing written yet
        val fifo = File(dir, "copy.fifo")
        assertEquals(0, ProcessBuilder("mkfifo", fifo.path).start().waitFor())
        val bytes = ByteArray(256 * 1024) { it.toByte() }
        var opened = 0L
        var read: ByteArray? = null
        val reader = thread {
            Thread.sleep(300)
            fifo.inputStream().use {
                opened = System.nanoTime()
                read = it.readBytes()
            }
        }
        ByteReadChannel(bytes).copyToFile(fifo)
        val returned = System.nanoTime()
        reader.join(5000)

        assertTrue(opened != 0L && returned >= opened, "returned before the file was opened")
        assertTrue(bytes.contentEquals(read))
        fifo.delete()
    }

    @Test
    fun `a file of exactly the limit is carved`() = withRoute {
        // A small image followed by padding up to the limit, which readers ignore after the PNG's end
        val png = testPng()
        val full = png + ByteArray(SEAM_CARVER_MAX_FILE_BYTES.toInt() - png.size)
        val call = upload(full, "width" to "9", "height" to "7")
        assertEquals(HttpStatusCode.OK, call.status, call.bodyAsText())
    }

    @Test
    fun `a malformed header of another format is refused with 400`() = withRoute {
        // A GIF and a TIFF header (found by fuzzing) whose ImageIO readers throw
        // IndexOutOfBoundsException rather than an IOException
        val headers = listOf(
            "474946383961a3c37ca2280ed03b64a94e6f9c64b307c211c246094430bf7e8c40dbf5545da4f4806ec9573b676d733014ce863618b8",
            "49492a00a56017e14f1ce8b1698341734a6823ce02043e016b544901214a2ddab82fec85",
        )
        for (hex in headers) {
            val bytes = hex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
            upload(bytes, "width" to "9", "height" to "7").assertRefused(HttpStatusCode.BadRequest, "Not an image")
        }
    }

    @Test
    fun `a failure to store the upload is the server's 500, not a malformed upload`() = testApplication {
        // An upload directory that doesn't exist, so no temporary file can be made
        routing { seamCarverUpload(SeamCarvingEngine(), File(dir, "missing")) }
        upload(testPng(), "width" to "9", "height" to "7")
            .assertRefused(HttpStatusCode.InternalServerError, "The server couldn't store the upload")
    }

    @Test
    fun `an image of more pixels than the limit is refused from its header`() = withRoute {
        val bomb = bombPng(20000, 20000)
        assertTrue(bomb.size < 1024, "${bomb.size} bytes")
        upload(bomb, "width" to "9", "height" to "7")
            .assertRefused(HttpStatusCode.PayloadTooLarge, "This image is 20000 x 20000 px, too large to carve")

        // One pixel over the limit, and the limit itself, which gets as far as checking the targets
        // (a valid target would carve the image, which takes the test's heap)
        upload(bombPng(SEAM_CARVER_MAX_PIXELS.toInt() + 1, 1), "width" to "9", "height" to "1")
            .assertRefused(HttpStatusCode.PayloadTooLarge, "too large to carve")
        upload(bombPng(SEAM_CARVER_MAX_PIXELS.toInt(), 1), "width" to "0", "height" to "1")
            .assertRefused(HttpStatusCode.BadRequest, "The width must be")
    }

    @Test
    fun `a file that isn't an image is refused with 400`() = withRoute {
        upload("not a PNG".toByteArray(), "width" to "9", "height" to "7")
            .assertRefused(HttpStatusCode.BadRequest, "Not an image")
    }

    @Test
    fun `missing fields are refused with 400`() = withRoute {
        upload(null, "width" to "9", "height" to "7").assertRefused(HttpStatusCode.BadRequest, "Missing the image file")
        upload(null).assertRefused(HttpStatusCode.BadRequest, "Missing the image file")
        upload(testPng(), "height" to "7").assertRefused(HttpStatusCode.BadRequest, "Missing width")
        upload(testPng(), "width" to "9").assertRefused(HttpStatusCode.BadRequest, "Missing height")
    }

    @Test
    fun `targets that aren't whole numbers from 1 to the image's size are refused with 400`() = withRoute {
        for (bad in listOf("nine", "9.5", "", "0", "-1", "13", "99999999999")) {
            upload(testPng(), "width" to bad, "height" to "7")
                .assertRefused(HttpStatusCode.BadRequest, "The width must be a whole number from 1 to the image's width, 12")
        }
        upload(testPng(), "width" to "9", "height" to "11")
            .assertRefused(HttpStatusCode.BadRequest, "The height must be a whole number from 1 to the image's height, 10")
    }

    @Test
    fun `a body that isn't multipart is refused`() = withRoute {
        val call = client.post("/seamCarver/upload") {
            contentType(ContentType.Text.Plain)
            setBody("width=9")
        }
        call.assertRefused(HttpStatusCode.UnsupportedMediaType, "Expected a multipart/form-data upload")
    }
}
