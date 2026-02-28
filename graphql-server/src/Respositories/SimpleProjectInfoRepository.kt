package com.zyoussef.Respositories

import com.zyoussef.Models.ProjectInfo.ProjectInfo
import com.zyoussef.Models.ProjectInfo.ProjectCategory

class SimpleProjectInfoRepository : IProjectInfoRepository {
    val cdnUrl = "http://zyoussef.com/assets/projectThumbnail"
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
            "$cdnUrl/raytrace.png"
        ),
        "webglDemo" to ProjectInfo(
            "Web GL Demo",
            "webglDemo",
            "A demonstration of webgl shaders and lighting",
            "$cdnUrl/webGlDemoThumbnail.png"
        ),
        "foundationDbFs" to ProjectInfo(
            "FoundationDB-FS",
            "foundationDbFs",
            "A distributed file system built on top of FoundationDB",
            "$cdnUrl/fdb_arch_noalpha.png"
        ),
    )

    val categories: Map<ProjectCategory, Set<String>> = mapOf(
        ProjectCategory.UNIVERSITY to setOf(
            "sokoban", 
            "seamCarver", 
            "raytracer", 
            "webglDemo", 
            "foundationDbFs"
        ),
        ProjectCategory.PROFESSIONAL to setOf(),
        ProjectCategory.PERSONAL to setOf()
    )

    val featuredIds: Set<String> = setOf("sokoban")

    override fun getProject(id: String): ProjectInfo? {
        return projectInfos[id];
    }

    override fun getAllProjects(featured: Boolean, category: ProjectCategory?): List<ProjectInfo> {
        return projectInfos.filter {
            (!featured || featuredIds.contains(it.key))
            && (category == null || categories[category]?.contains(it.key) ?: false)
        }.values.toList()
    }
}
