package com.zyoussef.Schema

import de.stuebingerb.kgraphql.schema.dsl.SchemaBuilder
import com.zyoussef.Content.Article
import com.zyoussef.Content.ProjectWriteup
import com.zyoussef.Content.WriteupSection
import com.zyoussef.Models.ProjectInfo.ProjectId
import com.zyoussef.Respositories.IProjectWriteupRepository

// The professional projects' pages: the projectWriteup query and its types. Kept out of
// Application.kt so that the schema's KGraphQL contract stays in one file.
fun SchemaBuilder.projectWriteupSchema(repository: IProjectWriteupRepository) {
    type<ProjectWriteup> {
        description = "The copy of a professional project's page; its title and image are the project's (projectInfo)"
    }

    type<WriteupSection> {
        description = "A part of a project page's body: an optional heading and its paragraphs"
    }

    type<Article> {
        description = "An article about a project; date is YYYY-MM or YYYY-MM-DD, or null if unknown"
    }

    query("projectWriteup") {
        description = "Retrieve a professional project's page copy by id; null for any other id"
        resolver { id: String ->
            ProjectId.fromId(id)?.let(repository::getWriteup)
        }
    }
}
