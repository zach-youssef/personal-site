package com.zyoussef

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import io.ktor.client.request.*
import io.ktor.client.request.forms.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.config.*
import io.ktor.server.http.content.*
import io.ktor.server.testing.*
import java.awt.Color
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.file.Files
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

    private suspend fun ApplicationTestBuilder.postGraphQLBody(body: Map<String, Any?>): HttpResponse =
        client.post("/graphql") {
            contentType(ContentType.Application.Json)
            setBody(mapper.writeValueAsString(body))
        }

    private suspend fun ApplicationTestBuilder.postGraphQL(query: String, variables: Map<String, Any?> = emptyMap()): HttpResponse =
        postGraphQLBody(mapOf("query" to query, "variables" to variables))

    // Runs a query that is expected to succeed and returns its "data" object
    private suspend fun ApplicationTestBuilder.graphQL(query: String, variables: Map<String, Any?> = emptyMap()): JsonNode {
        val response = postGraphQL(query, variables)
        assertEquals(HttpStatusCode.OK, response.status)
        val body = mapper.readTree(response.bodyAsText())
        assertTrue(body.path("errors").isMissingNode, "Unexpected errors: ${body.path("errors")}")
        return body.path("data")
    }

    // Runs the real module with the given config. testApplication would otherwise load
    // application.conf, which installs the module a second time (DuplicatePluginException). The
    // client doesn't follow redirects, so the tests see them.
    private fun withApp(
        config: MapApplicationConfig = MapApplicationConfig(),
        test: suspend ApplicationTestBuilder.() -> Unit,
    ) = testApplication {
        environment { this.config = config }
        application { module(testing = true) }
        client = createClient { followRedirects = false }
        test()
    }

    private suspend fun ApplicationTestBuilder.get(path: String, block: HttpRequestBuilder.() -> Unit = {}) = client.get(path, block)

    private fun HttpResponse.contentType(): ContentType = ContentType.parse(assertNotNull(headers[HttpHeaders.ContentType]))

    private fun JsonNode.texts(): List<String> = map { it.asText() }

    // Runs a query that is expected to fail, and checks the error reply's shape: KGraphQL answers 200
    // with a JSON body holding errors with messages. Errors found before executing the query (syntax,
    // validation) leave data out; errors while executing it (variable coercion, resolvers) send
    // data: null. The frontend parses the body whatever the status or type, and treats a missing or
    // null data alike, but another GraphQL library or version may change any of these, which should
    // be deliberate.
    private suspend fun ApplicationTestBuilder.graphQLErrors(
        query: String,
        variables: Map<String, Any?> = emptyMap(),
        executed: Boolean,
    ): JsonNode {
        val call = postGraphQL(query, variables)
        val text = call.bodyAsText()
        assertEquals(HttpStatusCode.OK, call.status)
        assertEquals("application/json", call.headers[HttpHeaders.ContentType])
        val body = mapper.readTree(text)
        val errors = body.path("errors")
        assertTrue(errors.isArray && errors.size() > 0, "Expected errors, got $text")
        assertTrue(errors.all { it.path("message").isTextual }, "Expected error messages, got $errors")
        if (executed) {
            assertTrue(body.path("data").isNull, "Expected null data, got $text")
        } else {
            assertTrue(body.path("data").isMissingNode, "Expected no data, got $text")
        }
        return errors
    }

    // Stands in a file of the frontend's build (which ./bundle puts in build/) unless it's there,
    // and removes it afterwards
    private inline fun withFrontendFile(name: String, content: String, test: (File) -> Unit) {
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

        assertEquals(listOf("zgal", "splats"), projects.map { it.path("id").asText() })
        assertEquals("ZGAL", projects[0].path("name").asText())
        assertTrue(projects[0].path("imagePath").asText().endsWith("/zgal.webp"))
    }

    @Test
    fun `every project thumbnail is served as webp`() = withApp {
        val paths = graphQL("{ projectInfos { imagePath } }").path("projectInfos").map { it.path("imagePath").asText() }
        assertTrue(paths.isNotEmpty())
        for (path in paths) {
            val call = get(path)
            assertEquals(HttpStatusCode.OK, call.status, path)
            assertEquals(ContentType.parse("image/webp"), call.headers[HttpHeaders.ContentType]?.let(ContentType::parse), path)
        }
    }

    @Test
    fun `images may be cached for a day and are revalidated with a 304`() = withApp {
        val path = "/assets/raytracer/ConeAndCylinder.webp"
        val first = get(path)
        assertEquals(HttpStatusCode.OK, first.status)
        assertEquals("max-age=86400", first.headers[HttpHeaders.CacheControl])
        val lastModified = assertNotNull(first.headers[HttpHeaders.LastModified])

        val again = get(path) {
            header(HttpHeaders.IfModifiedSince, lastModified)
        }
        assertEquals(HttpStatusCode.NotModified, again.status)
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
            val bare = get("/zgal/docs")
            assertEquals(HttpStatusCode.MovedPermanently, bare.status)
            assertEquals("/zgal/docs/", bare.headers[HttpHeaders.Location])

            val page = get("/zgal/docs/")
            assertEquals(HttpStatusCode.OK, page.status)
            assertTrue(page.contentType().match(ContentType.Text.Html))
            assertEquals("no-cache", page.headers[HttpHeaders.CacheControl])
            assertEquals(File(docsDir, "zgal.html").readText(), page.bodyAsText())

            val stylesheet = get("/zgal/docs/scribble.css")
            assertEquals(HttpStatusCode.OK, stylesheet.status)
            assertTrue(stylesheet.contentType().match(ContentType.Text.CSS))
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

            val call = get("/assets/${program.name}")
            assertEquals(HttpStatusCode.OK, call.status)
            assertEquals("text/plain; charset=utf-8", call.headers[HttpHeaders.ContentType])
            assertEquals(source, call.bodyAsText())
            // Still a file, which may be cached for a day and revalidated
            assertEquals("max-age=86400", call.headers[HttpHeaders.CacheControl])
            val again = get("/assets/${program.name}") {
                header(HttpHeaders.IfModifiedSince, assertNotNull(call.headers[HttpHeaders.LastModified]))
            }
            assertEquals(HttpStatusCode.NotModified, again.status)
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

            val call = get("/assets/${module.name}")
            assertEquals(HttpStatusCode.OK, call.status)
            assertEquals("application/wasm", call.headers[HttpHeaders.ContentType])
            assertTrue(bytes.contentEquals(call.bodyAsBytes()))
        } finally {
            module.delete()
        }
    }

    @Test
    fun `the app's page stays HTML at a path ending in zgal`() = withApp {
        // The frontend's build, which ./bundle puts here; without it, the test stands in a page
        withFrontendFile("index.html", "<title>Zoey</title>") {
            val call = get("/projects/zgal/particles.zgal")
            assertEquals(HttpStatusCode.OK, call.status)
            assertTrue(call.contentType().match(ContentType.Text.Html))
        }
    }

    @Test
    fun `GraphQL responses carry no caching headers`() = withApp {
        assertNull(postGraphQL("{ levels }").headers[HttpHeaders.CacheControl])
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
    fun `projectWriteup returns a professional project's page copy with every field`() = withApp {
        val writeup = graphQL(
            """
            {
                projectWriteup(id: "broadAR") {
                    id, context, imageAlt, sections { heading, paragraphs },
                    articles { title, source, date, url, note }
                }
            }
            """,
        ).path("projectWriteup")

        assertEquals("broadAR", writeup.path("id").asText())
        assertTrue(writeup.path("context").asText().isNotBlank())
        assertTrue(writeup.path("imageAlt").asText().isNotBlank())
        val sections = writeup.path("sections")
        assertTrue(sections.size() > 0)
        for (section in sections) {
            // Present, and null or text
            assertTrue(section.has("heading") && (section.path("heading").isNull || section.path("heading").isTextual), "$section")
            assertTrue(section.path("paragraphs").isArray && section.path("paragraphs").size() > 0, "$section")
            assertTrue(section.path("paragraphs").all { it.isTextual && it.asText().isNotBlank() }, "$section")
        }
        val articles = writeup.path("articles")
        assertTrue(articles.size() > 0)
        for (article in articles) {
            for (field in listOf("title", "source", "url", "note")) {
                assertTrue(article.path(field).isTextual && article.path(field).asText().isNotBlank(), "$field in $article")
            }
            assertTrue(article.has("date") && (article.path("date").isNull || article.path("date").isTextual), "$article")
            assertTrue(article.path("url").asText().startsWith("https://"), "$article")
        }
    }

    @Test
    fun `a project page's query gets the card's name and image and the write-up in one request`() = withApp {
        // The frontend's query (frontend/src/features/projectWriteup/ProjectWriteup.ts), verbatim
        val query = """
            query ProjectWriteupQuery(${'$'}id: String!) {
              projectInfo(id: ${'$'}id) { name, imagePath }
              projectWriteup(id: ${'$'}id) { context, imageAlt, sections { heading, paragraphs },
                                        articles { title, source, date, url, note } }
            }
        """
        for ((id, name) in listOf("broadAR" to "Broad Museum AR Experience", "metaAvatars" to "Mobile 3D Avatars")) {
            val data = graphQL(query, mapOf("id" to id))
            assertEquals(name, data.path("projectInfo").path("name").asText())
            assertTrue(data.path("projectInfo").path("imagePath").asText().endsWith(".webp"))
            assertTrue(data.path("projectWriteup").path("sections").size() > 0, id)
            assertTrue(data.path("projectWriteup").path("articles").size() > 0, id)
        }
    }

    @Test
    fun `projectWriteup is null for an unknown id or a project without a page`() = withApp {
        for (id in listOf("doesNotExist", "BroadAR", "", "zgal")) {
            assertTrue(graphQL("{ projectWriteup(id: \"$id\") { context } }").path("projectWriteup").isNull, id)
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
        val body = mapper.readTree(call.bodyAsText())
        assertTrue(body.path("errors").size() > 0, "Expected an error, got ${call.bodyAsText()}")
        assertTrue(body.path("data").isMissingNode || body.path("data").isNull)
    }

    @Test
    fun `other origins aren't allowed to call the backend`() = withApp {
        // The frontend is served by the backend, or proxied to it in development, so its
        // requests are same-origin and the backend grants no cross-origin access
        val call = client.options("/graphql") {
            header(HttpHeaders.Origin, "https://example.com")
            header(HttpHeaders.AccessControlRequestMethod, "POST")
            header(HttpHeaders.AccessControlRequestHeaders, "content-type")
        }
        assertNull(call.headers[HttpHeaders.AccessControlAllowOrigin])
    }

    // A 12x10 PNG to carve
    private fun testPng(): ByteArray {
        val input = BufferedImage(12, 10, BufferedImage.TYPE_INT_RGB)
        for (x in 0 until input.width) for (y in 0 until input.height) {
            input.setRGB(x, y, Color((x * 20) % 256, (y * 25) % 256, ((x + y) * 10) % 256).rgb)
        }
        return ByteArrayOutputStream().also { ImageIO.write(input, "png", it) }.toByteArray()
    }

    private fun FormBuilder.appendImage(bytes: ByteArray) = append("file", bytes, Headers.build {
        append(HttpHeaders.ContentDisposition, "filename=\"test.png\"")
        append(HttpHeaders.ContentType, ContentType.Image.PNG.toString())
    })

    // Carved images are written to this gitignored directory, which the server creates if needed;
    // removes what the test adds to it
    private inline fun withCarvingOutputs(test: () -> Unit) {
        val outputDir = File("assets/seamcarver/output")
        val existingOutputs = outputDir.listFiles()?.toSet() ?: emptySet()
        try {
            test()
        } finally {
            outputDir.listFiles()?.filter { it !in existingOutputs }?.forEach { it.delete() }
        }
    }

    @Test
    fun `seam carver upload returns an image of the requested size`() = withApp {
        val png = testPng()
        withCarvingOutputs {
            val call = client.submitFormWithBinaryData("/seamCarver/upload", formData {
                append("width", "9")
                append("height", "7")
                appendImage(png)
            })

            assertEquals(HttpStatusCode.OK, call.status)
            val carved = assertNotNull(ImageIO.read(assertNotNull(call.bodyAsBytes()).inputStream()))
            assertEquals(9, carved.width)
            assertEquals(7, carved.height)
        }
    }

    @Test
    fun `uploads leave no file behind while they're carved`() {
        val uploadDir = Files.createTempDirectory("seamcarver-uploads").toFile()
        try {
            withApp(MapApplicationConfig("seamcarver.uploadDir" to uploadDir.path)) {
                fun leftBehind() = uploadDir.list()!!.toList()
                val png = testPng()
                withCarvingOutputs {
                    // Two files: the second replaces the first
                    val twice = client.submitFormWithBinaryData("/seamCarver/upload", formData {
                        append("width", "9")
                        append("height", "7")
                        appendImage(png)
                        appendImage(png)
                    })
                    assertEquals(HttpStatusCode.OK, twice.status)
                    assertEquals(emptyList(), leftBehind(), "after two files")

                    // Not an image, so carving fails
                    val notAnImage = client.submitFormWithBinaryData("/seamCarver/upload", formData {
                        append("width", "9")
                        append("height", "7")
                        appendImage("not a PNG".toByteArray())
                    })
                    assertEquals(HttpStatusCode.InternalServerError, notAnImage.status)
                    assertEquals(emptyList(), leftBehind(), "after a failed carve")

                    // A width that isn't a number, after the file: the handler throws
                    val thrown = runCatching {
                        client.submitFormWithBinaryData("/seamCarver/upload", formData {
                            appendImage(png)
                            append("width", "nine")
                            append("height", "7")
                        })
                    }
                    assertTrue(thrown.isFailure || thrown.getOrThrow().status == HttpStatusCode.InternalServerError, "$thrown")
                    assertEquals(emptyList(), leftBehind(), "after the handler threw")
                }
            }
        } finally {
            uploadDir.deleteRecursively()
        }
    }

    // Characterization of Ktor 1.5.4 and KGraphQL 0.17.8, pinned before the port to Ktor 3 so it
    // can't change them silently

    @Test
    fun `a missing asset is a 404, not the app's page`() = withApp {
        withFrontendFile("index.html", "<title>Zoey</title>") {
            for (path in listOf("/assets/does-not-exist.png", "/assets/missing/does-not-exist.js")) {
                assertEquals(HttpStatusCode.NotFound, get(path).status, path)
            }
            // A directory has no index page, even with an index.html in it
            val dir = Files.createTempDirectory(File("assets").toPath(), "dir").toFile()
            try {
                File(dir, "index.html").writeText("<title>Index</title>")
                for (path in listOf("/assets/${dir.name}", "/assets/${dir.name}/")) {
                    assertEquals(HttpStatusCode.NotFound, get(path).status, path)
                }
            } finally {
                dir.deleteRecursively()
            }
        }
    }

    @Test
    fun `HEAD requests are answered with 404`() = withApp {
        // deploy.yml's live check relies on GET for this reason
        withFrontendFile("index.html", "<title>Zoey</title>") {
            assertEquals(HttpStatusCode.NotFound, client.head("/").status)
        }
    }

    @Test
    fun `the GraphQL playground is served at the endpoint`() = withApp {
        val call = get("/graphql")
        assertEquals(HttpStatusCode.OK, call.status)
        assertTrue(call.contentType().match(ContentType.Text.Html))
        assertTrue(assertNotNull(call.bodyAsText()).contains("<html", ignoreCase = true))
    }

    @Test
    fun `the frontend's top-level files are served from its build`() = withApp {
        withFrontendFile("robots.txt", "User-agent: *\n") { file ->
            val call = get("/robots.txt")
            assertEquals(HttpStatusCode.OK, call.status)
            assertTrue(call.contentType().match(ContentType.Text.Plain))
            assertEquals("max-age=86400", call.headers[HttpHeaders.CacheControl])
            assertEquals(file.readText(), call.bodyAsText())
        }
    }

    @Test
    fun `malformed and invalid queries are reported as GraphQL errors`() = withApp {
        graphQLErrors("{ levels ", executed = false)
        graphQLErrors("{ notAField }", executed = false)
    }

    @Test
    fun `enum variables must name a value exactly`() = withApp {
        val query = "query Q(\$level: SokobanLevelId!) { aStarSolution(levelId: \$level) }"
        // Unknown, and in the wrong case
        for (level in listOf("LEVEL_99", "level_0")) {
            graphQLErrors(query, mapOf("level" to level), executed = true)
        }
        graphQLErrors(
            "query Q(\$category: ProjectCategory) { projectInfos(category: \$category) { id } }",
            mapOf("category" to "NOT_A_CATEGORY"),
            executed = true,
        )
        // A list of enums, as GetStateAfterActionsQuery sends
        graphQLErrors(
            "query Q(\$level: SokobanLevelId!, \$actions: [SokobanMove!]!) { levelAfterActions(levelId: \$level, actions: \$actions) { level { row } } }",
            mapOf("level" to "LEVEL_0", "actions" to listOf("JUMP")),
            executed = true,
        )
    }

    @Test
    fun `a missing required variable is a GraphQL error`() = withApp {
        graphQLErrors("query Q(\$level: SokobanLevelId!) { aStarSolution(levelId: \$level) }", executed = true)
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

        val call = postGraphQLBody(mapOf("query" to query))
        assertEquals(HttpStatusCode.OK, call.status)
        assertEquals(all, mapper.readTree(call.bodyAsText()).path("data").ids())
    }

    @Test
    fun `illegal sokoban moves are a GraphQL error`() = withApp {
        // LEVEL_0's player starts against the wall on its left (row 1 is WALL, PLAYER, ...)
        graphQLErrors(
            "query Q(\$level: SokobanLevelId!, \$actions: [SokobanMove!]!) { levelAfterActions(levelId: \$level, actions: \$actions) { level { row } } }",
            mapOf("level" to "LEVEL_0", "actions" to listOf("LEFT")),
            executed = true,
        )
    }

    @Test
    fun `an upload missing a field falls through to a 404`() = withApp {
        suspend fun upload(vararg fields: Pair<String, String>) = client.submitFormWithBinaryData(
            "/seamCarver/upload",
            formData { for ((name, value) in fields) append(name, value) },
        )
        // No file, and nothing at all: the handler responds with nothing, which Ktor answers with 404
        assertEquals(HttpStatusCode.NotFound, upload("width" to "9", "height" to "7").status)
        assertEquals(HttpStatusCode.NotFound, upload().status)
    }

    @Test
    fun `CD's live check finds the levels in the reply's first bytes`() = withApp {
        // deploy.yml's "Check the live site" posts this exact body and greps for the prefix
        val response = client.post("/graphql") {
            contentType(ContentType.Application.Json)
            setBody("""{"query":"{ levels }"}""")
        }
        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.bodyAsText()
        assertTrue(body.startsWith("""{"data":{"levels":["""), body)
    }

    @Test
    fun `every query the frontend sends succeeds`() = withApp {
        // Copied from frontend/src with the variables it sends, so a change in how the GraphQL
        // library parses or coerces them shows here first
        val frontendQueries = listOf(
            // features/Home.tsx
            """
            query FetchFeaturedProjectsQuery {
              projectInfos(featured: true) {
                name,
                description,
                id,
                imagePath
              }
            }
            """ to emptyMap(),
            // features/projectDisplay/ProjectDisplayContainer.tsx, for a category's page
            """
            query FetchProjectsQuery(${'$'}category: ProjectCategory) {
                projectInfos(category: ${'$'}category) {
                    name,
                    description,
                    id,
                    imagePath
                }
            }
            """ to mapOf("category" to "UNIVERSITY"),
            // features/raytracer/RaytracerPage.tsx
            """
            query {
                raytracerImages
            }
            """ to emptyMap(),
            // graphql/SokobanQuieries.ts
            """
            query GetAvailableLevelsQuery {
                levels
            }
            """ to emptyMap(),
            """
            query GetLevelAndSolutionQuery(${'$'}level: SokobanLevelId!) {
                sokobanLevel(levelId: ${'$'}level) {
                    level {
                        row
                    }
                },
                aStarSolution(levelId: ${'$'}level),
                qLearningSolution(levelId: ${'$'}level)
            }
            """ to mapOf("level" to "LEVEL_1"),
            """
            query GetStateAfterActionsQuery(${'$'}level: SokobanLevelId!, ${'$'}actions: [SokobanMove!]!) {
                levelAfterActions(levelId: ${'$'}level, actions: ${'$'}actions) {
                    level {
                        row
                    }
                }
            }
            """ to mapOf("level" to "LEVEL_0", "actions" to emptyList<String>()),
        )
        for ((query, variables) in frontendQueries) {
            val data = graphQL(query, variables)
            assertTrue(data.isObject && data.size() > 0 && data.all { !it.isNull }, "$query: $data")
        }
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
