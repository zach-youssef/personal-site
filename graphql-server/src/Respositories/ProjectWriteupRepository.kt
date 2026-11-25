package com.zyoussef.Respositories

import com.zyoussef.Content.ProjectWriteup
import com.zyoussef.Content.ProjectWriteupLoader
import com.zyoussef.Models.ProjectInfo.ProjectId

// The professional projects' write-ups, keyed by project. Each write-up's id must be its key's.
class ProjectWriteupRepository(writeups: Map<ProjectId, ProjectWriteup>) : IProjectWriteupRepository {
    private val writeups: Map<ProjectId, ProjectWriteup> = ProjectId.entries.filter { it in writeups }.associateWith { id ->
        writeups.getValue(id).also { require(it.id == id.id) { "Write-up ${it.id} is keyed as ${id.id}" } }
    }

    override fun getWriteup(id: ProjectId): ProjectWriteup? = writeups[id]

    override fun getAllWriteups(): List<ProjectWriteup> = writeups.values.toList()

    companion object {
        // With the write-ups from resources/content/writeups/; throws if one is missing or invalid
        fun fromResource() = ProjectWriteupRepository(ProjectWriteupLoader.fromResources())
    }
}
