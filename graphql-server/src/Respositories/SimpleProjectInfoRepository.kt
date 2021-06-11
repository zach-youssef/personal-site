package com.zyoussef.Respositories

import com.zyoussef.Models.ProjectInfo.ProjectInfo

class SimpleProjectInfoRepository : IProjectInfoRepository {
    val cdnUrl = "http://localhost:8080/assets/projectThumbnail"
    val projectInfos: Map<String, ProjectInfo> = mapOf(
        "sokoban" to ProjectInfo(
            "Sokoban AI",
            "sokoban",
            "A* and Q Learning implementations to solve the game Sokoban",
            "$cdnUrl/sokoban.png"
        ),
        "seamCarver" to ProjectInfo(
            "Seam Carver",
            "seamCarver",
            "An algorithm for reshaping an image's aspect ratio",
            "$cdnUrl/seamCarver.png"
        ),
        "raytracer" to ProjectInfo(
            "Raytracer",
            "raytracer",
            "A simple raytracing algorithm",
            ""
        ),
        "webglDemo" to ProjectInfo(
            "Web GL Demo",
            "webglDemo",
            "A demonstration of webgl shaders and lighting",
            "$cdnUrl/webGlDemoThumbnail.png"
        )
    )

    val featuredIds: Set<String> = setOf("sokoban")

    override fun getProject(id: String): ProjectInfo? {
        return projectInfos[id];
    }

    override fun getAllProjects(featured: Boolean): List<ProjectInfo> {
        return projectInfos.filter {
            !featured || featuredIds.contains(it.key)
        }.values.toList()
    }
}