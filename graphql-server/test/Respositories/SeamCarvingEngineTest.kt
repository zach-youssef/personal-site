package com.zyoussef.Respositories

import java.awt.Color
import java.awt.image.BufferedImage
import java.io.File
import java.nio.file.Files
import javax.imageio.ImageIO
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class SeamCarvingEngineTest {
    private val dir = Files.createTempDirectory("seamcarver").toFile()
    private val engine = SeamCarvingEngine()

    @AfterTest
    fun cleanUp() {
        dir.deleteRecursively()
    }

    private fun gradient(name: String): File {
        val image = BufferedImage(12, 10, BufferedImage.TYPE_INT_RGB)
        for (x in 0 until image.width) for (y in 0 until image.height) {
            image.setRGB(x, y, Color((x * 20) % 256, (y * 25) % 256, ((x + y) * 10) % 256).rgb)
        }
        return File(dir, name).also { ImageIO.write(image, "png", it) }
    }

    @Test
    fun `carves to the target size into the output file`() {
        val output = File(dir, "out.png")
        assertTrue(engine.carve(gradient("in.png"), 9, 7, output))

        val image = assertNotNull(ImageIO.read(output))
        assertEquals(9, image.width)
        assertEquals(7, image.height)
    }

    @Test
    fun `replaces what the output file held`() {
        // As the route's output, a temporary file created empty, or a file left from before
        val output = File(dir, "out.png").apply { writeText("old") }
        assertTrue(engine.carve(gradient("in.png"), 9, 7, output))

        assertEquals(9, assertNotNull(ImageIO.read(output)).width)
    }

    @Test
    fun `writes nothing besides the output`() {
        val input = gradient("in.png")
        engine.carve(input, 9, 7, File(dir, "out.png"))

        assertEquals(setOf("in.png", "out.png"), dir.list()!!.toSet())
    }

    @Test
    fun `returns false for a file that isn't an image`() {
        val input = File(dir, "in.png").apply { writeText("not a PNG") }

        assertFalse(engine.carve(input, 9, 7, File(dir, "out.png")))
    }

    @Test
    fun `returns false when the output can't be written`() {
        // In a directory that doesn't exist
        assertFalse(engine.carve(gradient("in.png"), 9, 7, File(dir, "missing/out.png")))
    }
}
