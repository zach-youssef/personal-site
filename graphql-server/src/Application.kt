package com.zyoussef

import com.apurebase.kgraphql.GraphQL
import com.zyoussef.Models.ProjectInfo.ProjectInfo
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

@Suppress("unused") // Referenced in application.conf
@kotlin.jvm.JvmOverloads
fun Application.module(testing: Boolean = false) {
    install(CORS) {
        method(HttpMethod.Options)
        method(HttpMethod.Post)
        method(HttpMethod.Put)

        header("Content-Type");

        anyHost()
        allowCredentials = true
    }
    routing {
    	static {
            // CDN Assets
            static("assets"){
                files("assets")
            }

            // Main frontend static
            static("static") {
                files("build/static")
            }

            // WebGL Demo resources
            static("out") {
                files("hogwarts/out")
            }
            static("json") {
                files("hogwarts/json")
            }
            static("models") {
                files("hogwarts/models")
            }
            static("textures") {
                files("hogwarts/textures")
            }

            // Frontend top-level files
            file("asset-manifest.json", "build/asset-manifest.json")
            file("favicon.ico", "build/favicon.ico")
            file("logo192.png", "build/logo192.png")
            file("logo512.png", "build/logo512.png")
            file("manifest.json", "build/manifest.json")
            file("robots.txt", "build/robots.txt")

            // WebGL Demo entrypoint
            file("Scenegraphs.html", "hogwarts/Scenegraphs.html")

            file("{...}", "build/index.html")
        }

        post("/seamCarver/upload") {
            val seamCarvingRepository = SeamCarvingEngine()

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
                        imageFile = File("assets/seamcarver/input/upload.png")
                        imageFile!!.writeBytes(part.streamProvider().readBytes())
                    }
                    else -> {}
                }
            }

            // Carve the image and return the output file
            if (imageFile != null && targetHeight != null && targetWidth != null) {
                val carved = seamCarvingRepository.carve(imageFile!!, targetWidth!!, targetHeight!!)
                if (carved != null) {
                    call.respondFile(carved)
                }
            }
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

            query("projectInfo") {
                description = "Retrieve a projects metadata by id"
                resolver { id: String ->
                    projectInfoRepository.getProject(id)
                }
            }

            query("projectInfos") {
                description = "Retrieve all project metadata, with optional filter for featured projects"
                resolver { featured: Boolean? ->
                    projectInfoRepository.getAllProjects(featured ?: false)
                }.withArgs {
                    arg <Boolean> { name = "featured"; defaultValue = false }
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

            query("raytracerImages") {
                description = "Returns a list of images output from my raytracer"
                resolver { ->
                    File("assets/raytracer").list().map {
                        "http://zyoussef.com/assets/raytracer/$it"
                    }
                }
            }
        }
    }
}

