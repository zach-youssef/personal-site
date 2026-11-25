package com.zyoussef.Schema

import de.stuebingerb.kgraphql.schema.dsl.SchemaBuilder
import com.zyoussef.Content.Article
import com.zyoussef.Content.ProjectWriteup
import com.zyoussef.Content.WriteupFigure
import com.zyoussef.Content.WriteupLink
import com.zyoussef.Content.WriteupSection
import com.zyoussef.Content.WriteupVideo
import com.zyoussef.Models.ProjectInfo.ProjectId
import com.zyoussef.Respositories.IProjectWriteupRepository

// The write-up pages (the professional projects' and a few others'): the projectWriteup query and its types. Kept out of
// Application.kt so that the schema's KGraphQL contract stays in one file.
fun SchemaBuilder.projectWriteupSchema(repository: IProjectWriteupRepository) {
    type<ProjectWriteup> {
        description = "The copy of a project's page; its title, and its image unless it has a video, are the project's (projectInfo). imageAlt is null when a video takes the image's place"
    }

    type<WriteupSection> {
        description = "A part of a project page's body: an optional heading, its paragraphs, then its figures"
    }

    type<WriteupFigure> {
        description = "A diagram in a section: src is a root-relative SVG among the backend's assets, alt describes it, caption goes under it"
    }

    type<WriteupVideo> {
        description = "A YouTube video, by the id in its URL, shown in place of the page's image"
    }

    type<WriteupLink> {
        description = "A link to the project itself, such as its repository; url is https://"
    }

    type<Article> {
        description = "An article about a project; date is YYYY-MM or YYYY-MM-DD, or null if unknown"
    }

    query("projectWriteup") {
        description = "Retrieve a project's page copy by id; null for a project without a write-up page or an unknown id"
        resolver { id: String ->
            ProjectId.fromId(id)?.let(repository::getWriteup)
        }
    }
}
