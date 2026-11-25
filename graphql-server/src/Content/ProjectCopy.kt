package com.zyoussef.Content

import com.fasterxml.jackson.core.type.TypeReference
import com.zyoussef.Models.ProjectInfo.ProjectId

// A project's copy, as written in resources/content/projects.yaml (see the README's "Site copy")
data class ProjectCopy(
    // The card's heading
    val title: String,
    // The card's one-line summary
    val description: String,
    // The card's image, as a root-relative URL so it loads over whichever protocol the page uses
    val thumbnail: String,
)

object ProjectCopyLoader {
    const val RESOURCE = "content/projects.yaml"

    // The site's copy. Throws ProjectCopyException if the file is missing or invalid, so that a
    // mistake in it stops the server from starting rather than showing up on the site.
    fun fromResource(): Map<ProjectId, ProjectCopy> = parse(ContentYaml.resourceText(RESOURCE), RESOURCE)

    // Parses and checks a projects.yaml document: one entry for every ProjectId, keyed by its id,
    // no other keys, and every field present and non-blank. `source` names it in error messages.
    fun parse(yaml: String, source: String): Map<ProjectId, ProjectCopy> {
        val entries = ContentYaml.parse(yaml, source, object : TypeReference<Map<String, ProjectCopy>?>() {})

        val problems = mutableListOf<String>()
        val unknown = entries.keys.filter { ProjectId.fromId(it) == null }
        if (unknown.isNotEmpty()) problems += "unknown project ids $unknown (projects are listed in ProjectId)"
        val missing = ProjectId.entries.filter { it.id !in entries }.map { it.id }
        if (missing.isNotEmpty()) problems += "no entry for $missing"
        for ((id, copy) in entries) {
            for ((field, value) in listOf("title" to copy.title, "description" to copy.description, "thumbnail" to copy.thumbnail)) {
                if (value.isBlank()) problems += "$id: $field is blank"
            }
            if (copy.thumbnail.isNotBlank() && !copy.thumbnail.startsWith("/")) {
                problems += "$id: thumbnail must be a root-relative URL starting with /"
            }
        }
        if (problems.isNotEmpty()) throw ProjectCopyException("$source: ${problems.joinToString("; ")}")

        return ProjectId.entries.associateWith { entries.getValue(it.id) }
    }
}
