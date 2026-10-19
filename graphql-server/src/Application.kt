package com.zyoussef

import com.apurebase.kgraphql.GraphQL
import com.zyoussef.Models.ProjectInfo.*
import com.zyoussef.Models.Sokoban.*
import com.zyoussef.Respositories.*
import io.ktor.application.*
import io.ktor.features.*
import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.request.*
import io.ktor.response.*
import io.ktor.routing.*
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

@Suppress("unused") // Referenced in application.conf
@kotlin.jvm.JvmOverloads
fun Application.module(testing: Boolean = false) {
    // Static files carry Last-Modified, so browsers can revalidate a cached copy and get a
    // 304 instead of downloading it again
    install(ConditionalHeaders)
    install(CachingHeaders) {
        options(::cachingOptions)
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

            val multiPartData = call.receiveMultipart()
            var imageFile: File? = null
            var targetWidth: Int? = null
            var targetHeight: Int? = null
            // Parse form data
            multiPartData.forEachPart { part ->
                when(part) {
                    is PartData.FormItem -> {
                        when(part.name) {
                            "width" -> targetWidth = Integer.parseInt(part.value)
                            "height" -> targetHeight = Integer.parseInt(part.value)
                        }
                    }
                    is PartData.FileItem -> {
                        // A file per request, so concurrent uploads can't overwrite each other
                        imageFile = File.createTempFile("seamcarver-upload", ".png")
                        imageFile!!.writeBytes(part.streamProvider().readBytes())
                    }
                    else -> {}
                }
            }

            // Carve the image and return the output file
            if (imageFile != null && targetHeight != null && targetWidth != null) {
                try {
                    val carved = seamCarvingRepository.carve(imageFile!!, targetWidth!!, targetHeight!!)
                    if (carved != null) {
                        call.respondFile(carved)
                    } else {
                        call.respondText("Unknown error ocurred", status = HttpStatusCode(500, "Internal server error"))
                    }
                } catch (e: OutOfMemoryError) {
                    call.respondText("Ran out of memory, try a smaller image", status = HttpStatusCode(413, "Input image too large"))
                }
            }
            imageFile?.delete()
        }
    }
    install(GraphQL) {
        playground = true
        schema {
            // Project Metadata
            val projectInfoRepository: IProjectInfoRepository = SimpleProjectInfoRepository()

            type<ProjectInfo> {
                description = "Metadata for a project featured on the website"
            }

            enum<ProjectCategory> {
                description = "Types of projects featured on the website"
            }


            query("projectInfo") {
                description = "Retrieve a projects metadata by id"
                resolver { id: String ->
                    projectInfoRepository.getProject(id)
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
    install(CallLogging)
}

