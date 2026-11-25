package com.zyoussef.Models.ProjectInfo

import com.zyoussef.Models.ProjectInfo.ProjectCategory.*

// Every project on the site, in the order the site lists it: the unfiltered list, each category's
// list and the home page's featured projects all keep this order. A constant's name is the
// project's public id, used in its URL (/projects/<id>), as its GraphQL id and as its key in
// resources/content/projects.yaml, which holds its copy (title, description, thumbnail). Renaming
// a constant changes all three.
@Suppress("EnumEntryName")
enum class ProjectId(val category: ProjectCategory, val featured: Boolean) {
    broadAR(PROFESSIONAL, featured = false),
    metaAvatars(PROFESSIONAL, featured = false),
    vkPPU(PERSONAL, featured = false),
    zgal(PERSONAL, featured = true),
    splats(PERSONAL, featured = true),
    sokoban(UNIVERSITY, featured = false),
    seamCarver(UNIVERSITY, featured = false),
    foundationDbFs(UNIVERSITY, featured = false),
    raytracer(UNIVERSITY, featured = false),
    webglDemo(UNIVERSITY, featured = false),
    ;

    val id: String get() = name

    companion object {
        private val byId = entries.associateBy { it.id }

        // The project with this public id, or null if there's none
        fun fromId(id: String): ProjectId? = byId[id]
    }
}
