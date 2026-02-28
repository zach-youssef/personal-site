package com.zyoussef.Respositories

import com.zyoussef.Models.ProjectInfo.ProjectInfo
import com.zyoussef.Models.ProjectInfo.ProjectCategory

interface IProjectInfoRepository {
    // Returns a specific project's metadata by id
    fun getProject(id: String): ProjectInfo?

    // Return the entire list of project metadata
    // If featured is true, only returns projects flagged as featured
    // Applies the category filter if specified
    fun getAllProjects(featured: Boolean = false, category: ProjectCategory? = null): List<ProjectInfo>
}