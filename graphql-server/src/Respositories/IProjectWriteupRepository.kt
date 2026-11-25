package com.zyoussef.Respositories

import com.zyoussef.Content.ProjectWriteup
import com.zyoussef.Models.ProjectInfo.ProjectId

interface IProjectWriteupRepository {
    // The project's write-up, or null if it has no page of its own
    fun getWriteup(id: ProjectId): ProjectWriteup?

    // Every write-up, in ProjectId order
    fun getAllWriteups(): List<ProjectWriteup>
}
