package com.zyoussef.Respositories

import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals

class RaytracerImageRepositoryTest {
    @Test
    fun `lists images in the directory as sorted urls`() {
        val dir = Files.createTempDirectory("raytracer").toFile()
        try {
            for (name in listOf("b.png", "a.png", "c.png")) dir.resolve(name).writeText("")

            assertEquals(
                listOf("http://cdn/a.png", "http://cdn/b.png", "http://cdn/c.png"),
                RaytracerImageRepository(dir, "http://cdn").getImageUrls(),
            )
        } finally {
            dir.deleteRecursively()
        }
    }

    @Test
    fun `a missing directory has no images`() {
        val missing = Files.createTempDirectory("raytracer").toFile().apply { delete() }

        assertEquals(emptyList(), RaytracerImageRepository(missing, "http://cdn").getImageUrls())
    }
}
