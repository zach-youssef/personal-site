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
import org.slf4j.LoggerFactory

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

    // Runs a query that is expected to fail, and checks the error reply's shape: KGraphQL answers 200
    // with a JSON body (sent as text/plain) holding errors with messages and no data. The frontend
    // parses the body whatever the status or type, but a port to another GraphQL library may change
    // either, which should be deliberate.
    private fun TestApplicationEngine.graphQLErrors(query: String, variables: Map<String, Any?> = emptyMap()): JsonNode {
        val call = postGraphQL(query, variables)
        assertEquals(HttpStatusCode.OK, call.response.status())
        assertEquals("text/plain; charset=UTF-8", call.response.headers[HttpHeaders.ContentType])
        val body = mapper.readTree(call.response.content)
        val errors = body.path("errors")
        assertTrue(errors.isArray && errors.size() > 0, "Expected errors, got ${call.response.content}")
        assertTrue(errors.all { it.path("message").isTextual }, "Expected error messages, got $errors")
        assertTrue(body.path("data").isMissingNode, "Expected no data, got ${call.response.content}")
        return errors
    }

    // Stands in a file of the frontend's build (which ./bundle puts in build/) unless it's there,
    // and removes it afterwards
    private fun withFrontendFile(name: String, content: String, test: (File) -> Unit) {
        val file = File("build", name)
        val stubbed = !file.exists()
        if (stubbed) {
            file.parentFile.mkdirs()
            file.writeText(content)
        }
        try {
            test(file)
        } finally {
            if (stubbed) {
                file.delete()
            }
        }
    }

    @Test
    fun `projectInfos returns the featured projects`() = withApp {
        val data = graphQL("{ projectInfos(featured: true) { id, name, description, imagePath } }")
        val projects = data.path("projectInfos")

        assertEquals(listOf("vkPPU", "zgal", "splats"), projects.map { it.path("id").asText() })
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
    fun `ZGAL programs are served as UTF-8 text, so browsers show them`() = withApp {
        // A program of its own beside ./build-zgal's, which may not have been built
        val program = File.createTempFile("program", ".zgal", File("assets")).apply { deleteOnExit() }
        try {
            val source = "(define greeting \"héllo\") ; ✓\n"
            program.writeText(source)

            val call = handleRequest(HttpMethod.Get, "/assets/${program.name}")
            assertEquals(HttpStatusCode.OK, call.response.status())
            assertEquals("text/plain; charset=utf-8", call.response.headers[HttpHeaders.ContentType])
            assertEquals(source, call.response.content)
            // Still a file, which may be cached for a day and revalidated
            assertEquals("max-age=86400", call.response.headers[HttpHeaders.CacheControl])
            val again = handleRequest(HttpMethod.Get, "/assets/${program.name}") {
                addHeader(HttpHeaders.IfModifiedSince, assertNotNull(call.response.headers[HttpHeaders.LastModified]))
            }
            assertEquals(HttpStatusCode.NotModified, again.response.status())
        } finally {
            program.delete()
        }
    }

    @Test
    fun `WebAssembly is served as application wasm, which streaming compilation requires`() = withApp {
        // A module of its own, as ./build-zgal copies a program's *.wasm, which none may have
        val module = File.createTempFile("module", ".wasm", File("assets")).apply { deleteOnExit() }
        try {
            // The smallest module: the magic and version 1
            val bytes = byteArrayOf(0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00)
            module.writeBytes(bytes)

            val call = handleRequest(HttpMethod.Get, "/assets/${module.name}")
            assertEquals(HttpStatusCode.OK, call.response.status())
            assertEquals("application/wasm", call.response.headers[HttpHeaders.ContentType])
            assertTrue(bytes.contentEquals(call.response.byteContent))
        } finally {
            module.delete()
        }
    }

    @Test
    fun `the app's page stays HTML at a path ending in zgal`() = withApp {
        // The frontend's build, which ./bundle puts here; without it, the test stands in a page
        withFrontendFile("index.html", "<title>Zoey</title>") {
            val call = handleRequest(HttpMethod.Get, "/projects/zgal/particles.zgal")
            assertEquals(HttpStatusCode.OK, call.response.status())
            assertTrue(ContentType.parse(assertNotNull(call.response.headers[HttpHeaders.ContentType])).match(ContentType.Text.Html))
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
    fun `projectInfo is null for an unknown id`() = withApp {
        // Ids are case sensitive
        for (id in listOf("doesNotExist", "SeamCarver", "")) {
            assertTrue(graphQL("{ projectInfo(id: \"$id\") { name } }").path("projectInfo").isNull, id)
        }
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

    // Characterization of Ktor 1.5.4 and KGraphQL 0.17.8, pinned before the port to Ktor 3 so it
    // can't change them silently

    @Test
    fun `a missing asset is a 404, not the app's page`() = withApp {
        withFrontendFile("index.html", "<title>Zoey</title>") {
            for (path in listOf("/assets/does-not-exist.png", "/assets/missing/does-not-exist.js")) {
                assertEquals(HttpStatusCode.NotFound, handleRequest(HttpMethod.Get, path).response.status(), path)
            }
        }
    }

    @Test
    fun `HEAD requests are answered with 404`() = withApp {
        // deploy.yml's live check relies on GET for this reason
        withFrontendFile("index.html", "<title>Zoey</title>") {
            assertEquals(HttpStatusCode.NotFound, handleRequest(HttpMethod.Head, "/").response.status())
        }
    }

    @Test
    fun `the GraphQL playground is served at the endpoint`() = withApp {
        val call = handleRequest(HttpMethod.Get, "/graphql")
        assertEquals(HttpStatusCode.OK, call.response.status())
        assertTrue(ContentType.parse(assertNotNull(call.response.headers[HttpHeaders.ContentType])).match(ContentType.Text.Html))
        assertTrue(assertNotNull(call.response.content).contains("<html", ignoreCase = true))
    }

    @Test
    fun `the frontend's top-level files are served from its build`() = withApp {
        withFrontendFile("robots.txt", "User-agent: *\n") { file ->
            val call = handleRequest(HttpMethod.Get, "/robots.txt")
            assertEquals(HttpStatusCode.OK, call.response.status())
            assertTrue(ContentType.parse(assertNotNull(call.response.headers[HttpHeaders.ContentType])).match(ContentType.Text.Plain))
            assertEquals("max-age=86400", call.response.headers[HttpHeaders.CacheControl])
            assertEquals(file.readText(), call.response.content)
        }
    }

    @Test
    fun `malformed and invalid queries are reported as GraphQL errors`() = withApp {
        graphQLErrors("{ levels ")
        graphQLErrors("{ notAField }")
    }

    @Test
    fun `enum variables must name a value exactly`() = withApp {
        val query = "query Q(\$level: SokobanLevelId!) { aStarSolution(levelId: \$level) }"
        // Unknown, and in the wrong case
        for (level in listOf("LEVEL_99", "level_0")) {
            graphQLErrors(query, mapOf("level" to level))
        }
        graphQLErrors(
            "query Q(\$category: ProjectCategory) { projectInfos(category: \$category) { id } }",
            mapOf("category" to "NOT_A_CATEGORY"),
        )
        // A list of enums, as GetStateAfterActionsQuery sends
        graphQLErrors(
            "query Q(\$level: SokobanLevelId!, \$actions: [SokobanMove!]!) { levelAfterActions(levelId: \$level, actions: \$actions) { level { row } } }",
            mapOf("level" to "LEVEL_0", "actions" to listOf("JUMP")),
        )
    }

    @Test
    fun `a missing required variable is a GraphQL error`() = withApp {
        graphQLErrors("query Q(\$level: SokobanLevelId!) { aStarSolution(levelId: \$level) }")
    }

    @Test
    fun `an omitted optional variable is null`() = withApp {
        // FetchProjectsQuery sends {"category": undefined} for the page of all projects, which
        // JSON.stringify drops; all three forms must list every project, as the query without the
        // argument does
        val query = "query FetchProjectsQuery(\$category: ProjectCategory) { projectInfos(category: \$category) { id } }"
        fun JsonNode.ids() = path("projectInfos").map { it.path("id").asText() }
        val all = graphQL("{ projectInfos { id } }").ids()
        // So that matching it means no filter was applied
        assertTrue(all.size > graphQL(query, mapOf("category" to "PROFESSIONAL")).ids().size, "$all")
        assertEquals(all, graphQL(query).ids())
        assertEquals(all, graphQL(query, mapOf("category" to null)).ids())

        val call = handleRequest(HttpMethod.Post, "/graphql") {
            addHeader(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody(mapper.writeValueAsString(mapOf("query" to query)))
        }
        assertEquals(HttpStatusCode.OK, call.response.status())
        assertEquals(all, mapper.readTree(call.response.content).path("data").ids())
    }

    @Test
    fun `illegal sokoban moves are a GraphQL error`() = withApp {
        // LEVEL_0's player starts against the wall on its left (row 1 is WALL, PLAYER, ...)
        graphQLErrors(
            "query Q(\$level: SokobanLevelId!, \$actions: [SokobanMove!]!) { levelAfterActions(levelId: \$level, actions: \$actions) { level { row } } }",
            mapOf("level" to "LEVEL_0", "actions" to listOf("LEFT")),
        )
    }

    @Test
    fun `an upload missing a field falls through to a 404`() = withApp {
        val boundary = "seam-carver-test"
        fun upload(vararg fields: Pair<String, String>) = handleRequest(HttpMethod.Post, "/seamCarver/upload") {
            addHeader(HttpHeaders.ContentType, ContentType.MultiPart.FormData.withParameter("boundary", boundary).toString())
            setBody(boundary, fields.map { (name, value) ->
                PartData.FormItem(value, {}, Headers.build {
                    append(HttpHeaders.ContentDisposition, ContentDisposition.Inline.withParameter(ContentDisposition.Parameters.Name, name).toString())
                })
            })
        }
        // No file, and nothing at all: the handler responds with nothing, which Ktor answers with 404
        assertEquals(HttpStatusCode.NotFound, upload("width" to "9", "height" to "7").response.status())
        assertEquals(HttpStatusCode.NotFound, upload().response.status())
    }

    @Test
    fun `logging goes to logback`() {
        // Ktor 3 logs through SLF4J 2, which an old logback doesn't bind: logging would silently
        // stop (callTrace.log included) with only a warning on stderr
        assertTrue(
            LoggerFactory.getILoggerFactory() is ch.qos.logback.classic.LoggerContext,
            "SLF4J is bound to ${LoggerFactory.getILoggerFactory().javaClass}",
        )
    }
}
