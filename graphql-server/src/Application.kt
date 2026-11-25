package com.zyoussef

import com.zyoussef.Models.ProjectInfo.*
import com.zyoussef.Models.Sokoban.*
import com.zyoussef.Respositories.*
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
import io.ktor.util.*
import io.ktor.util.cio.*
import io.ktor.utils.io.*
import java.io.File

fun main(args: Array<String>): Unit = io.ktor.server.netty.EngineMain.main(args)

// How long browsers may reuse a response before checking it again; null leaves it unset
internal fun cachingOptions(content: OutgoingContent): CachingOptions? = when {
    // Files are streamed (static() wraps them in its own type); GraphQL replies are text
    content !is OutgoingContent.ReadChannelContent -> null
    // Pages name the current frontend bundle, so they're checked on every visit
    content.contentType?.match(ContentType.Text.Html) == true -> CachingOptions(CacheControl.NoCache(null))
    // Everything else may be reused for a day before being checked again. Images keep
    // their names when they're replaced, so they can't be cached for good.
    else -> CachingOptions(CacheControl.MaxAge(maxAgeSeconds = 24 * 60 * 60))
}

// ZGAL programs (.zgal) are text, but Ktor doesn't know the extension and would send them as
// application/octet-stream, which browsers download rather than show
private val ZGAL_SOURCE_TYPE = ContentType.Text.Plain.withParameter("charset", "utf-8")

// A file's content as another type. static() wraps the files it sends in a type of its own, which
// is internal to Ktor, so this wraps that in turn and passes everything but the type through,
// including the properties (Last-Modified) that caching reads.
private class RetypedContent(
    private val original: OutgoingContent.ReadChannelContent,
    override val contentType: ContentType,
) : OutgoingContent.ReadChannelContent() {
    override val contentLength get() = original.contentLength
    override val status get() = original.status
    override val headers get() = original.headers
    override fun readFrom() = original.readFrom()
    override fun readFrom(range: LongRange) = original.readFrom(range)
    override fun trailers() = original.trailers()
    override fun <T : Any> getProperty(key: AttributeKey<T>) = original.getProperty(key)
    override fun <T : Any> setProperty(key: AttributeKey<T>, value: T?) = original.setProperty(key, value)
}

@Suppress("unused") // Referenced in application.conf
@kotlin.jvm.JvmOverloads
fun Application.module(testing: Boolean = false) {
    // Loaded first, so that invalid copy in resources/content/projects.yaml stops the server at startup
    val projectInfoRepository: IProjectInfoRepository = SimpleProjectInfoRepository.fromResource()
    // Where uploads are written while they're carved: the system's temporary directory unless the
    // config names one (the tests do, to check that none is left behind)
    val uploadDir = environment.config.propertyOrNull("seamcarver.uploadDir")?.getString()?.let(::File)

    // Static files carry Last-Modified, so browsers can revalidate a cached copy and get a
    // 304 instead of downloading it again
    install(ConditionalHeaders)
    install(CachingHeaders) {
        options { _, content -> cachingOptions(content) }
    }
    // Static files are sent with the type Ktor guesses from their extension. Only what it couldn't
    // type is retyped, so the app's page, which the backend serves for any other path, stays HTML.
    // Ktor types WebAssembly (.wasm) itself as application/wasm, which browsers'
    // WebAssembly.instantiateStreaming requires.
    sendPipeline.intercept(ApplicationSendPipeline.Before) { content ->
        if (content is OutgoingContent.ReadChannelContent && call.request.path().endsWith(".zgal")
            && content.contentType?.match(ContentType.Application.OctetStream) == true) {
            proceedWith(RetypedContent(content, ZGAL_SOURCE_TYPE))
        }
    }

    routing {
    	static {
            // CDN Assets
            static("assets"){
                files("assets")
            }

            // ZGAL's documentation, which ./build-zgal builds into the assets. The page names its
            // stylesheets and scripts relative to itself, so it's served from the directory's URL.
            static("zgal/docs") {
                get {
                    call.respondRedirect("/zgal/docs/", permanent = true)
                }
                get("/") {
                    call.respondFile(File("assets/zgal/docs/zgal.html"))
                }
                files("assets/zgal/docs")
            }

            // Frontend top-level files
            // TODO - find a way to not need to manualy list out all these routes
            file("favicon.ico", "build/favicon.ico")
            file("logo192.png", "build/logo192.png")
            file("logo512.png", "build/logo512.png")
            file("manifest.json", "build/manifest.json")
            file("robots.txt", "build/robots.txt")
            file("github-mark.svg", "build/github-mark.svg")
            file("InBug-Black.png", "build/InBug-Black.png")

            file("{...}", "build/index.html")
        }

        post("/seamCarver/upload") {
            val seamCarvingRepository = SeamCarvingEngine(File("assets/seamcarver/output"))

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

