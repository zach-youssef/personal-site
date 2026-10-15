package com.zyoussef.Respositories

import java.awt.Color
import java.awt.image.BufferedImage
import java.io.File
import java.nio.file.Files
import javax.imageio.ImageIO
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SeamCarvingEngineTest {
    private val dir = Files.createTempDirectory("seamcarver").toFile()
    private val engine = SeamCarvingEngine(dir)

    @AfterTest
    fun cleanUp() {
        dir.deleteRecursively()
    }

    private fun gradient(name: String, seed: Int): File {
        val image = BufferedImage(12, 10, BufferedImage.TYPE_INT_RGB)
        for (x in 0 until image.width) for (y in 0 until image.height) {
            image.setRGB(x, y, Color((x * 20 + seed) % 256, (y * 25) % 256, ((x + y) * 10) % 256).rgb)
        }
        return File(dir, name).also { ImageIO.write(image, "png", it) }
    }

    @Test
    fun `carves to the target size`() {
        val carved = assertNotNull(engine.carve(gradient("in.png", 0), 9, 7))

        val image = ImageIO.read(carved)
        assertEquals(9, image.width)
        assertEquals(7, image.height)
    }

    @Test
    fun `names output by a hex digest of the input and the target size`() {
        val carved = assertNotNull(engine.carve(gradient("in.png", 0), 9, 7))

        assertEquals(dir, carved.parentFile)
        assertTrue(Regex("[0-9a-f]{64}-9-7\\.png").matches(carved.name), carved.name)
    }

    @Test
    fun `identical inputs reuse the cached output`() {
        val first = assertNotNull(engine.carve(gradient("a.png", 0), 9, 7))
        first.writeText("cached")

        // Same content under a different name
        val second = assertNotNull(engine.carve(gradient("b.png", 0), 9, 7))

        assertEquals(first, second)
        assertEquals("cached", second.readText())
    }

    @Test
    fun `different inputs or sizes get different outputs`() {
        val original = assertNotNull(engine.carve(gradient("a.png", 0), 9, 7))

        assertNotEquals(original, engine.carve(gradient("b.png", 1), 9, 7))
        assertNotEquals(original, engine.carve(gradient("a.png", 0), 8, 7))
    }

    @Test
    fun `creates the output directory if it is missing`() {
        val outputDir = File(dir, "nested/output")
        val carved = assertNotNull(SeamCarvingEngine(outputDir).carve(gradient("in.png", 0), 9, 7))

        assertEquals(outputDir, carved.parentFile)
        assertTrue(carved.exists())
    }

    @Test
    fun `returns null when the output can't be written`() {
        // A file where the output directory should be
        val blocked = File(dir, "blocked").apply { writeText("") }

        assertNull(SeamCarvingEngine(blocked).carve(gradient("in.png", 0), 9, 7))
    }
}
