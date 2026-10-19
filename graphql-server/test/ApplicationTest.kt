package com.zyoussef

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.testing.*
import io.ktor.utils.io.core.*
import java.awt.Color
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import java.io.File
import javax.imageio.ImageIO
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Exercises the real application module over HTTP, including the GraphQL schema and resolvers
class ApplicationTest {
    private val mapper = ObjectMapper()

    private fun TestApplicationEngine.postGraphQL(query: String, variables: Map<String, Any?> = emptyMap()): TestApplicationCall =
        handleRequest(HttpMethod.Post, "/graphql") {
            addHeader(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody(mapper.writeValueAsString(mapOf("query" to query, "variables" to variables)))
        }

    // Runs a query that is expected to succeed and returns its "data" object
    private fun TestApplicationEngine.graphQL(query: String, variables: Map<String, Any?> = emptyMap()): JsonNode {
        val call = postGraphQL(query, variables)
        assertEquals(HttpStatusCode.OK, call.response.status())
        val body = mapper.readTree(call.response.content)
        assertTrue(body.path("errors").isMissingNode, "Unexpected errors: ${body.path("errors")}")
        return body.path("data")
    }

    private fun withApp(test: TestApplicationEngine.() -> Unit) = withTestApplication({ module(testing = true) }, test)

    private fun JsonNode.texts(): List<String> = map { it.asText() }

    @Test
    fun `projectInfos returns the featured projects`() = withApp {
        val data = graphQL("{ projectInfos(featured: true) { id, name, description, imagePath } }")
        val projects = data.path("projectInfos")

        assertEquals(listOf("vkPPU", "zgal"), projects.map { it.path("id").asText() })
        assertEquals("Vulkan Retro PPU", projects[0].path("name").asText())
        assertTrue(projects[0].path("imagePath").asText().endsWith("/ppu.webp"))
    }

    @Test
    fun `every project thumbnail is served as webp`() = withApp {
        val paths = graphQL("{ projectInfos { imagePath } }").path("projectInfos").map { it.path("imagePath").asText() }
        assertTrue(paths.isNotEmpty())
        for (path in paths) {
            val call = handleRequest(HttpMethod.Get, path)
            assertEquals(HttpStatusCode.OK, call.response.status(), path)
            assertEquals(ContentType.parse("image/webp"), call.response.headers[HttpHeaders.ContentType]?.let(ContentType::parse), path)
        }
    }

    @Test
    fun `images may be cached for a day and are revalidated with a 304`() = withApp {
        val path = "/assets/raytracer/ConeAndCylinder.webp"
        val first = handleRequest(HttpMethod.Get, path)
        assertEquals(HttpStatusCode.OK, first.response.status())
        assertEquals("max-age=86400", first.response.headers[HttpHeaders.CacheControl])
        val lastModified = assertNotNull(first.response.headers[HttpHeaders.LastModified])

        val again = handleRequest(HttpMethod.Get, path) {
            addHeader(HttpHeaders.IfModifiedSince, lastModified)
        }
        assertEquals(HttpStatusCode.NotModified, again.response.status())
    }

    @Test
    fun `pages are checked on every visit`() {
        val page = File.createTempFile("page", ".html").apply { deleteOnExit() }
        val options = assertNotNull(cachingOptions(LocalFileContent(page)))
        assertEquals("no-cache", options.cacheControl.toString())
    }

    @Test
    fun `ZGAL's documentation is served from its directory's URL`() = withApp {
        // ./build-zgal builds the documentation into this gitignored directory; without it, the
        // test stands in a page and stylesheet of its own
        val docsDir = File("assets/zgal/docs")
        val stubbed = !docsDir.exists()
        if (stubbed) {
            docsDir.mkdirs()
            File(docsDir, "zgal.html").writeText("<link rel=\"stylesheet\" href=\"scribble.css\"><title>ZGAL</title>")
            File(docsDir, "scribble.css").writeText("body {}")
        }
        try {
            // The page's relative links only resolve from the directory
            val bare = handleRequest(HttpMethod.Get, "/zgal/docs")
            assertEquals(HttpStatusCode.MovedPermanently, bare.response.status())
            assertEquals("/zgal/docs/", bare.response.headers[HttpHeaders.Location])

            val page = handleRequest(HttpMethod.Get, "/zgal/docs/")
            assertEquals(HttpStatusCode.OK, page.response.status())
            assertTrue(ContentType.parse(assertNotNull(page.response.headers[HttpHeaders.ContentType])).match(ContentType.Text.Html))
            assertEquals("no-cache", page.response.headers[HttpHeaders.CacheControl])
            assertEquals(File(docsDir, "zgal.html").readText(), page.response.content)

            val stylesheet = handleRequest(HttpMethod.Get, "/zgal/docs/scribble.css")
            assertEquals(HttpStatusCode.OK, stylesheet.response.status())
            assertTrue(ContentType.parse(assertNotNull(stylesheet.response.headers[HttpHeaders.ContentType])).match(ContentType.Text.CSS))
        } finally {
            if (stubbed) {
                docsDir.deleteRecursively()
            }
        }
    }

    @Test
    fun `GraphQL responses carry no caching headers`() = withApp {
        assertNull(postGraphQL("{ levels }").response.headers[HttpHeaders.CacheControl])
    }

    @Test
    fun `projectInfos filters by category variable`() = withApp {
        val data = graphQL(
            "query FetchProjectsQuery(\$category: ProjectCategory) { projectInfos(category: \$category) { id } }",
            mapOf("category" to "PROFESSIONAL"),
        )
        assertEquals(listOf("broadAR", "metaAvatars"), data.path("projectInfos").map { it.path("id").asText() })
    }

    @Test
    fun `projectInfo looks up a single project`() = withApp {
        val data = graphQL("{ projectInfo(id: \"seamCarver\") { name } }")
        assertEquals("Seam Carver", data.path("projectInfo").path("name").asText())
    }

    @Test
    fun `levels lists every sokoban level`() = withApp {
        assertEquals(listOf("LEVEL_0", "LEVEL_1", "LEVEL_2"), graphQL("{ levels }").path("levels").texts())
    }

    @Test
    fun `level and solutions query returns the layout and both agents' moves`() = withApp {
        val data = graphQL(
            """
            query GetLevelAndSolutionQuery(${'$'}level: SokobanLevelId!) {
                sokobanLevel(levelId: ${'$'}level) { level { row } },
                aStarSolution(levelId: ${'$'}level),
                qLearningSolution(levelId: ${'$'}level)
            }
            """,
            mapOf("level" to "LEVEL_0"),
        )

        assertEquals(
            listOf("WALL", "PLAYER", "EMPTY", "BOX", "EMPTY", "SPOT", "WALL"),
            data.path("sokobanLevel").path("level")[1].path("row").texts(),
        )
        assertEquals(listOf("RIGHT", "RIGHT", "RIGHT"), data.path("aStarSolution").texts())
        assertEquals(15, data.path("qLearningSolution").size())
    }

    @Test
    fun `levelAfterActions replays moves on the server`() = withApp {
        val data = graphQL(
            """
            query GetStateAfterActionsQuery(${'$'}level: SokobanLevelId!, ${'$'}actions: [SokobanMove!]!) {
                levelAfterActions(levelId: ${'$'}level, actions: ${'$'}actions) { level { row } }
            }
            """,
            mapOf("level" to "LEVEL_0", "actions" to listOf("RIGHT", "RIGHT", "RIGHT")),
        )

        assertEquals(
            listOf("WALL", "EMPTY", "EMPTY", "EMPTY", "PLAYER", "FILLED_SPOT", "WALL"),
            data.path("levelAfterActions").path("level")[1].path("row").texts(),
        )
    }

    @Test
    fun `raytracerImages lists image urls`() = withApp {
        // Works whether or not the gitignored assets/raytracer directory exists locally
        val urls = graphQL("{ raytracerImages }").path("raytracerImages").texts()
        assertTrue(urls.all { it.startsWith("/assets/raytracer/") }, "$urls")
    }

    @Test
    fun `invalid enum values are reported as GraphQL errors`() = withApp {
        val call = postGraphQL("{ sokobanLevel(levelId: LEVEL_99) { level { row } } }")
        val body = mapper.readTree(call.response.content)
        assertTrue(body.path("errors").size() > 0, "Expected an error, got ${call.response.content}")
        assertTrue(body.path("data").isMissingNode || body.path("data").isNull)
    }

    @Test
    fun `other origins aren't allowed to call the backend`() = withApp {
        // The frontend is served by the backend, or proxied to it in development, so its
        // requests are same-origin and the backend grants no cross-origin access
        val call = handleRequest(HttpMethod.Options, "/graphql") {
            addHeader(HttpHeaders.Origin, "https://example.com")
            addHeader(HttpHeaders.AccessControlRequestMethod, "POST")
            addHeader(HttpHeaders.AccessControlRequestHeaders, "content-type")
        }
        assertNull(call.response.headers[HttpHeaders.AccessControlAllowOrigin])
    }

    @Test
    fun `seam carver upload returns an image of the requested size`() = withApp {
        // Carved images are written to this gitignored directory, which the server creates if needed
        val outputDir = File("assets/seamcarver/output")
        val existingOutputs = outputDir.listFiles()?.toSet() ?: emptySet()

        val input = BufferedImage(12, 10, BufferedImage.TYPE_INT_RGB)
        for (x in 0 until input.width) for (y in 0 until input.height) {
            input.setRGB(x, y, Color((x * 20) % 256, (y * 25) % 256, ((x + y) * 10) % 256).rgb)
        }
        val png = ByteArrayOutputStream().also { ImageIO.write(input, "png", it) }.toByteArray()

        val boundary = "seam-carver-test"
        try {
            val call = handleRequest(HttpMethod.Post, "/seamCarver/upload") {
                addHeader(HttpHeaders.ContentType, ContentType.MultiPart.FormData.withParameter("boundary", boundary).toString())
                setBody(boundary, listOf(
                    PartData.FormItem("9", {}, Headers.build {
                        append(HttpHeaders.ContentDisposition, ContentDisposition.Inline.withParameter(ContentDisposition.Parameters.Name, "width").toString())
                    }),
                    PartData.FormItem("7", {}, Headers.build {
                        append(HttpHeaders.ContentDisposition, ContentDisposition.Inline.withParameter(ContentDisposition.Parameters.Name, "height").toString())
                    }),
                    PartData.FileItem({ ByteReadPacket(png) }, {}, Headers.build {
                        append(HttpHeaders.ContentDisposition, ContentDisposition.File
                            .withParameter(ContentDisposition.Parameters.Name, "file")
                            .withParameter(ContentDisposition.Parameters.FileName, "test.png").toString())
                        append(HttpHeaders.ContentType, ContentType.Image.PNG.toString())
                    }),
                ))
            }

            assertEquals(HttpStatusCode.OK, call.response.status())
            val carved = assertNotNull(ImageIO.read(assertNotNull(call.response.byteContent).inputStream()))
            assertEquals(9, carved.width)
            assertEquals(7, carved.height)
        } finally {
            outputDir.listFiles()?.filter { it !in existingOutputs }?.forEach { it.delete() }
        }
    }
}
