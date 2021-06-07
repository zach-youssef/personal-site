package com.zyoussef

import com.apurebase.kgraphql.GraphQL
import com.zyoussef.Models.ProjectInfo.ProjectInfo
import com.zyoussef.Models.Sokoban.*
import com.zyoussef.Respositories.IProjectInfoRepository
import com.zyoussef.Respositories.ISokobanRepository
import com.zyoussef.Respositories.SimpleProjectInfoRepository
import com.zyoussef.Respositories.SokobanEngine
import io.ktor.application.*
import io.ktor.features.*
import io.ktor.http.*

fun main(args: Array<String>): Unit = io.ktor.server.netty.EngineMain.main(args)

@Suppress("unused") // Referenced in application.conf
@kotlin.jvm.JvmOverloads
fun Application.module(testing: Boolean = false) {
    install(CORS) {
        method(HttpMethod.Options)
        method(HttpMethod.Post)

        header("Content-Type");

        anyHost()
        allowCredentials = true
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
        }
    }
}

