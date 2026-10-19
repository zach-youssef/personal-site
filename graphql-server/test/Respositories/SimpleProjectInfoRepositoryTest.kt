package com.zyoussef.Respositories

import com.zyoussef.Models.ProjectInfo.ProjectCategory
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SimpleProjectInfoRepositoryTest {
    private val repository = SimpleProjectInfoRepository()

    @Test
    fun `looks up projects by id`() {
        val project = repository.getProject("sokoban")
        assertEquals("Sokoban AI", project?.name)
        assertEquals("sokoban", project?.id)
        assertNull(repository.getProject("doesNotExist"))
    }

    @Test
    fun `returns every project when unfiltered`() {
        assertEquals(repository.projectInfos.values.toList(), repository.getAllProjects())
    }

    @Test
    fun `featured filter only returns featured projects`() {
        val featured = repository.getAllProjects(featured = true)
        assertTrue(featured.isNotEmpty(), "The home page expects at least one featured project")
        assertEquals(repository.featuredIds, featured.map { it.id }.toSet())
    }

    @Test
    fun `category filter returns only that category's projects`() {
        for (category in ProjectCategory.values()) {
            assertEquals(
                repository.categories[category],
                repository.getAllProjects(category = category).map { it.id }.toSet(),
                "$category",
            )
        }
    }

    @Test
    fun `side projects are the PPU and ZGAL`() {
        assertEquals(listOf("vkPPU", "zgal"), repository.getAllProjects(category = ProjectCategory.PERSONAL).map { it.id })
    }

    @Test
    fun `featured and category filters combine`() {
        assertEquals(listOf("vkPPU", "zgal"), repository.getAllProjects(true, ProjectCategory.PERSONAL).map { it.id })
        assertEquals(emptyList(), repository.getAllProjects(true, ProjectCategory.UNIVERSITY))
    }

    @Test
    fun `every project is keyed by its id and belongs to exactly one category`() {
        for ((key, project) in repository.projectInfos) {
            assertEquals(key, project.id)
            assertEquals(1, repository.categories.values.count { key in it }, "$key category count")
        }
        assertTrue(repository.categories.values.flatten().all { it in repository.projectInfos }, "Categories reference unknown ids")
        assertTrue(repository.featuredIds.all { it in repository.projectInfos }, "Featured ids reference unknown ids")
    }
}
