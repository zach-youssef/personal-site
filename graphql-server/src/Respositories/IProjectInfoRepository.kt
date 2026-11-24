package com.zyoussef.Respositories

import com.zyoussef.Models.ProjectInfo.ProjectCategory
import com.zyoussef.Models.ProjectInfo.ProjectId
import com.zyoussef.Models.ProjectInfo.ProjectInfo

interface IProjectInfoRepository {
    // Returns a specific project's metadata
    fun getProject(id: ProjectId): ProjectInfo

    // Return the entire list of project metadata, in ProjectId order
    // If featured is true, only returns projects flagged as featured
    // Applies the category filter if specified
    fun getAllProjects(featured: Boolean = false, category: ProjectCategory? = null): List<ProjectInfo>
}
