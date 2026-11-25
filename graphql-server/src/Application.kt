package com.zyoussef

import com.zyoussef.Models.ProjectInfo.*
import com.zyoussef.Models.Sokoban.*
import com.zyoussef.Respositories.*
import com.zyoussef.Schema.projectWriteupSchema
import de.stuebingerb.kgraphql.GraphQL
import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.application.*
import io.ktor.server.http.content.*
import io.ktor.server.plugins.cachingheaders.*
import io.ktor.server.plugins.calllogging.*
import io.ktor.server.plugins.conditionalheaders.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.io.File

fun main(args: Array<String>): Unit = io.ktor.server.netty.EngineMain.main(args)

// How long browsers may reuse a response before checking it again; null leaves it unset
internal fun cachingOptions(content: OutgoingContent): CachingOptions? = when {
    // Files are streamed; GraphQL replies are text
    content !is OutgoingContent.ReadChannelContent -> null
    // Pages name the current frontend bundle, and the JSON manifests (ZGAL's source.json, the splat's
    // scene.json, the seam carver's manifest.json) name the current builds' files, so they're
    // checked on every visit
    content.contentType?.match(ContentType.Text.Html) == true ||
        content.contentType?.match(ContentType.Application.Json) == true -> CachingOptions(CacheControl.NoCache(null))
    // Everything else may be reused for a day before being checked again. Images keep
    // their names when they're replaced, so they can't be cached for good.
    else -> CachingOptions(CacheControl.MaxAge(maxAgeSeconds = 24 * 60 * 60))
}

// ZGAL programs (.zgal) are text, but Ktor doesn't know the extension and would send them as
// application/octet-stream, which browsers download rather than show. Every other file keeps the
// type Ktor guesses from its extension; it types WebAssembly (.wasm) itself as application/wasm,
// which browsers' WebAssembly.instantiateStreaming requires.
private fun staticFileType(file: File): ContentType? =
    if (file.extension == "zgal") ContentType.Text.Plain.withParameter("charset", "utf-8") else null

// Sends a file of the frontend's build (which ./bundle puts in build/), or nothing if it's missing,
// which Ktor answers with 404
private suspend fun ApplicationCall.respondFrontendFile(name: String) {
    val file = File("build", name)
    if (file.isFile) {
        respondFile(file)
    }
}

@Suppress("unused") // Referenced in application.conf
@kotlin.jvm.JvmOverloads
fun Application.module(testing: Boolean = false) {
    // Loaded first, so that invalid copy in resources/content/ stops the server at startup
    val projectInfoRepository: IProjectInfoRepository = SimpleProjectInfoRepository.fromResource()
    val projectWriteupRepository: IProjectWriteupRepository = ProjectWriteupRepository.fromResource()

    // Where uploads and their carved images are written while they're carved: the system's temporary directory unless the
    // config names one (the tests do, to check that none is left behind)
    val uploadDir = environment.config.propertyOrNull("seamcarver.uploadDir")?.getString()?.let(::File)

    // Static files carry Last-Modified, so browsers can revalidate a cached copy and get a
    // 304 instead of downloading it again
    install(ConditionalHeaders)
    install(CachingHeaders) {
        options { _, content -> cachingOptions(content) }
    }

    routing {
        // CDN Assets. A missing file is a 404, not the app's page, and a directory has no index.
        staticFiles("/assets", File("assets"), index = null) {
            contentType(::staticFileType)
        }

        // ZGAL's documentation, which ./build-zgal builds into the assets. The page names its
        // stylesheets and scripts relative to itself, so it's served from the directory's URL.
        route("/zgal/docs") {
            get {
                call.respondRedirect("/zgal/docs/", permanent = true)
            }
        }
        staticFiles("/zgal/docs", File("assets/zgal/docs"), index = "zgal.html")

        // Frontend top-level files, listed so that the rest of build/ isn't served
        for (name in listOf(
            "favicon.ico", "logo192.png", "logo512.png", "manifest.json", "robots.txt",
            "github-mark.svg", "InBug-Black.png",
        )) {
            get("/$name") { call.respondFrontendFile(name) }
        }

        // The app's page for any other path, last, so the frontend's router picks the page. GET
        // only: HEAD requests are answered with 404, as before.
        get("{...}") { call.respondFrontendFile("index.html") }

        seamCarverUpload(SeamCarvingEngine(), uploadDir)
    }
    install(GraphQL) {
        playground = true
        schema {
            // Project Metadata
            type<ProjectInfo> {
                description = "Metadata for a project featured on the website"
            }

            enum<ProjectCategory> {
                description = "Types of projects featured on the website"
            }


            query("projectInfo") {
                description = "Retrieve a projects metadata by id"
                resolver { id: String ->
                    // Null for an id that isn't a project's
                    ProjectId.fromId(id)?.let(projectInfoRepository::getProject)
                }
            }

            query("projectInfos") {
                description = "Retrieve all project metadata, with optional filter for featured projects"
                resolver { featured: Boolean?, category: ProjectCategory? ->
                    projectInfoRepository.getAllProjects(featured ?: false, category)
                }
            }

            // Professional projects' pages
            projectWriteupSchema(projectWriteupRepository)

            // Sokoban AI
            val sokobanRepository: ISokobanRepository = SokobanEngine()

            enum<SokobanMove> {
                description = "A possible move by an agent playing sokoban"
            }

            enum<SokobanSquare> {
                description = "A square on the board of a sokoban level"
            }

            enum<SokobanLevelId> {
                description = "A unique identifier for each available sokoban level"
            }

            type<SokobanLevel> {
                description = "A single sokoban puzzle, composed of a grid of squares"
            }

            query("aStarSolution") {
                description = "Get a list of moves to solve a level found by an AStar agent"
                resolver { levelId: SokobanLevelId ->
                    sokobanRepository.solveAStar(levelId)
                }
            }

            query("qLearningSolution") {
                description = "Get a list of moves to solve a level after a q learning agent solves it"
                resolver { levelId: SokobanLevelId ->
                    sokobanRepository.solveQAgent(levelId)
                }
            }

            query("sokobanLevel") {
                description = "Get the layout of a particular level"
                resolver { levelId: SokobanLevelId ->
                    sokobanRepository.getLevel(levelId)
                }
            }

            query("levels") {
                description = "Returns the ids of all available levels"
                resolver { -> sokobanRepository.getAvailableLevels() }
            }

            query("levelAfterActions") {
                description = "Returns the state of the requested level after the specified actions are taken. Will fail if moves are illegal"
                resolver { levelId: SokobanLevelId, actions: List<SokobanMove> ->
                    sokobanRepository.getLevelAfterActions(levelId, actions)
                }
            }

            // Raytracer
            val raytracerRepository: IRaytracerRepository =
                RaytracerImageRepository(File("assets/raytracer"), "/assets/raytracer")

            query("raytracerImages") {
                description = "Returns a list of images output from my raytracer"
                resolver { -> raytracerRepository.getImageUrls() }
            }
        }
    }
    install(CallLogging) {
        // Colors would put ANSI escapes in callTrace.log, and installing Jansi's console loads a
        // native library, which recent JDKs warn about in server.log
        disableDefaultColors()
    }
}

