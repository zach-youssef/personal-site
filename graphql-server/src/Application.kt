package com.zyoussef

import com.apurebase.kgraphql.GraphQL
import com.zyoussef.Models.ProjectInfo.ProjectInfo
import com.zyoussef.Respositories.IProjectInfoRepository
import com.zyoussef.Respositories.SimpleProjectInfoRepository
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
        }
    }
}

