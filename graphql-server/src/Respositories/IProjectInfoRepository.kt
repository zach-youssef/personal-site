package com.zyoussef.Respositories

import com.zyoussef.Models.ProjectInfo.ProjectInfo

interface IProjectInfoRepository {
    // Returns a specific project's metadata by id
    fun getProject(id: String): ProjectInfo?

    // Return the entire list of project metadata
    // If featured is true, only returns projects flagged as featured
    fun getAllProjects(featured: Boolean = false): List<ProjectInfo>
}