package com.zyoussef.Respositories

import com.zyoussef.Models.ProjectInfo.ProjectCategory
import com.zyoussef.Models.ProjectInfo.ProjectId
import com.zyoussef.Models.ProjectInfo.ProjectInfo

class SimpleProjectInfoRepository : IProjectInfoRepository {
    // Relative, so thumbnails load over whichever protocol the page uses
    private val cdnUrl = "/assets/projectThumbnail"
    private val projects: Map<ProjectId, ProjectInfo> = mapOf(
        ProjectId.sokoban to ProjectInfo(
            "Sokoban AI",
            "sokoban",
            "A* and Q Learning implementations to solve the game Sokoban",
            "$cdnUrl/sokoban.webp"
        ),
        ProjectId.seamCarver to ProjectInfo(
            "Seam Carver",
            "seamCarver",
            "An algorithm for reshaping an image's aspect ratio",
            "$cdnUrl/seamCarver.webp"
        ),
        ProjectId.raytracer to ProjectInfo(
            "Raytracer",
            "raytracer",
            "A simple raytracing algorithm",
            // Also shown on the raytracer page, so the browser downloads it once for both
            "/assets/raytracer/TransparencyWithMirrorWalls.webp"
        ),
        ProjectId.webglDemo to ProjectInfo(
            "Web GL Demo",
            "webglDemo",
            "A demonstration of webgl shaders and lighting",
            "$cdnUrl/webGlDemoThumbnail.webp"
        ),
        ProjectId.foundationDbFs to ProjectInfo(
            "FoundationDB-FS",
            "foundationDbFs",
            "A distributed file system built on top of FoundationDB",
            "$cdnUrl/fdb_arch_noalpha.webp"
        ),
        ProjectId.broadAR to ProjectInfo(
            "Broad Museum AR Experience",
            "broadAR",
            "Location tracked AR Experience I worked on at Meta",
            "$cdnUrl/broad.webp"
        ),
        ProjectId.metaAvatars to ProjectInfo(
            "Mobile 3D Avatars",
            "metaAvatars",
            "Mobile & AR rendering changes for Avatar Style Upgrade",
            "$cdnUrl/ava.webp"
        ),
        ProjectId.vkPPU to ProjectInfo(
            "Vulkan Retro PPU",
            "vkPPU",
            "Vulkan Compute Pipeline for rendering NES games",
            "$cdnUrl/ppu.webp"
        ),
        ProjectId.zgal to ProjectInfo(
            "ZGAL",
            "zgal",
            "A language for GPU programs that compiles to Vulkan and WebGPU",
            "$cdnUrl/zgal.webp"
        ),
        ProjectId.splats to ProjectInfo(
            "Gaussian Splatting",
            "splats",
            "A 3D Gaussian splatting trainer and real-time viewer written in ZGAL, running in the browser with WebGPU",
            "$cdnUrl/splats.webp"
        ),
    )

    init {
        require(projects.keys == ProjectId.entries.toSet()) { "Every project needs an entry" }
    }

    override fun getProject(id: ProjectId): ProjectInfo = projects.getValue(id)

    override fun getAllProjects(featured: Boolean, category: ProjectCategory?): List<ProjectInfo> =
        ProjectId.entries
            .filter { (!featured || it.featured) && (category == null || it.category == category) }
            .map { projects.getValue(it) }
}
