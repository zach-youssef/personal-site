package com.zyoussef.Respositories

import com.zyoussef.Content.ProjectCopy
import com.zyoussef.Content.ProjectCopyLoader
import com.zyoussef.Models.ProjectInfo.ProjectCategory
import com.zyoussef.Models.ProjectInfo.ProjectId
import com.zyoussef.Models.ProjectInfo.ProjectInfo

// The projects of ProjectId, with the copy of each. `copy` must have an entry for every project.
class SimpleProjectInfoRepository(copy: Map<ProjectId, ProjectCopy>) : IProjectInfoRepository {
    private val projects: Map<ProjectId, ProjectInfo> = ProjectId.entries.associateWith { id ->
        val entry = requireNotNull(copy[id]) { "No copy for project ${id.id}" }
        ProjectInfo(entry.title, id.id, entry.description, entry.thumbnail)
    }

    override fun getProject(id: ProjectId): ProjectInfo = projects.getValue(id)

    override fun getAllProjects(featured: Boolean, category: ProjectCategory?): List<ProjectInfo> =
        ProjectId.entries
            .filter { (!featured || it.featured) && (category == null || it.category == category) }
            .map { projects.getValue(it) }

    companion object {
        // With the site's copy from resources/content/projects.yaml; throws if it's invalid
        fun fromResource() = SimpleProjectInfoRepository(ProjectCopyLoader.fromResource())
    }
}
