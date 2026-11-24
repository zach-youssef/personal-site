package com.zyoussef.Respositories

import com.zyoussef.Models.ProjectInfo.ProjectCategory
import com.zyoussef.Models.ProjectInfo.ProjectId
import com.zyoussef.Models.ProjectInfo.ProjectInfo
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SimpleProjectInfoRepositoryTest {
    private val repository = SimpleProjectInfoRepository()

    // Golden: the site's projects, their copy and order. A change to either updates this.
    private val expected = listOf(
        ProjectInfo("Sokoban AI", "sokoban", "A* and Q Learning implementations to solve the game Sokoban", "/assets/projectThumbnail/sokoban.webp"),
        ProjectInfo("Seam Carver", "seamCarver", "An algorithm for reshaping an image's aspect ratio", "/assets/projectThumbnail/seamCarver.webp"),
        ProjectInfo("Raytracer", "raytracer", "A simple raytracing algorithm", "/assets/raytracer/TransparencyWithMirrorWalls.webp"),
        ProjectInfo("Web GL Demo", "webglDemo", "A demonstration of webgl shaders and lighting", "/assets/projectThumbnail/webGlDemoThumbnail.webp"),
        ProjectInfo("FoundationDB-FS", "foundationDbFs", "A distributed file system built on top of FoundationDB", "/assets/projectThumbnail/fdb_arch_noalpha.webp"),
        ProjectInfo("Broad Museum AR Experience", "broadAR", "Location tracked AR Experience I worked on at Meta", "/assets/projectThumbnail/broad.webp"),
        ProjectInfo("Mobile 3D Avatars", "metaAvatars", "Mobile & AR rendering changes for Avatar Style Upgrade", "/assets/projectThumbnail/ava.webp"),
        ProjectInfo("Vulkan Retro PPU", "vkPPU", "Vulkan Compute Pipeline for rendering NES games", "/assets/projectThumbnail/ppu.webp"),
        ProjectInfo("ZGAL", "zgal", "A language for GPU programs that compiles to Vulkan and WebGPU", "/assets/projectThumbnail/zgal.webp"),
        ProjectInfo("Gaussian Splatting", "splats", "A 3D Gaussian splatting trainer and real-time viewer written in ZGAL, running in the browser with WebGPU", "/assets/projectThumbnail/splats.webp"),
    )

    private fun ids(projects: List<ProjectInfo>) = projects.map { it.id }

    @Test
    fun `returns every project with its copy, in order, when unfiltered`() {
        assertEquals(expected, repository.getAllProjects())
    }

    @Test
    fun `looks up projects by id`() {
        for (project in expected) {
            assertEquals(project, repository.getProject(ProjectId.fromId(project.id)!!))
        }
    }

    @Test
    fun `featured filter returns the side projects in order`() {
        assertEquals(listOf("vkPPU", "zgal", "splats"), ids(repository.getAllProjects(featured = true)))
    }

    @Test
    fun `category filter returns that category's projects in order`() {
        assertEquals(
            listOf("sokoban", "seamCarver", "raytracer", "webglDemo", "foundationDbFs"),
            ids(repository.getAllProjects(category = ProjectCategory.UNIVERSITY)),
        )
        assertEquals(listOf("broadAR", "metaAvatars"), ids(repository.getAllProjects(category = ProjectCategory.PROFESSIONAL)))
        assertEquals(listOf("vkPPU", "zgal", "splats"), ids(repository.getAllProjects(category = ProjectCategory.PERSONAL)))
    }

    @Test
    fun `featured and category filters combine`() {
        assertEquals(listOf("vkPPU", "zgal", "splats"), ids(repository.getAllProjects(true, ProjectCategory.PERSONAL)))
        assertEquals(emptyList(), repository.getAllProjects(true, ProjectCategory.UNIVERSITY))
    }

    @Test
    fun `the home page has at least one featured project`() {
        assertTrue(repository.getAllProjects(featured = true).isNotEmpty())
    }
}
