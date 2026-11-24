package com.zyoussef.Content

import com.fasterxml.jackson.core.JacksonException
import com.fasterxml.jackson.core.StreamReadFeature
import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper
import com.fasterxml.jackson.module.kotlin.kotlinModule
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

class ProjectCopyException(message: String, cause: Throwable? = null) : IllegalStateException(message, cause)

object ProjectCopyLoader {
    // Read from the classpath, so it works from the fat jar as well as from the source tree
    const val RESOURCE = "content/projects.yaml"

    private val mapper = YAMLMapper.builder()
        .addModule(kotlinModule())
        // A repeated key would otherwise silently replace the first entry
        .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
        .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
        // A second `---` document would otherwise be ignored without a word
        .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
        .build()

    // The site's copy. Throws ProjectCopyException if the file is missing or invalid, so that a
    // mistake in it stops the server from starting rather than showing up on the site.
    fun fromResource(): Map<ProjectId, ProjectCopy> {
        val stream = ProjectCopyLoader::class.java.classLoader.getResourceAsStream(RESOURCE)
            ?: throw ProjectCopyException("$RESOURCE: not found on the classpath")
        return parse(stream.use { it.readBytes().decodeToString() }, RESOURCE)
    }

    // Parses and checks a projects.yaml document: one entry for every ProjectId, keyed by its id,
    // no other keys, and every field present and non-blank. `source` names it in error messages.
    fun parse(yaml: String, source: String): Map<ProjectId, ProjectCopy> {
        val entries: Map<String, ProjectCopy> = try {
            mapper.readValue(yaml, object : TypeReference<Map<String, ProjectCopy>?>() {})
        } catch (e: JacksonException) {
            throw ProjectCopyException("$source: ${e.originalMessage}${e.location?.let { " (line ${it.lineNr}, column ${it.columnNr})" } ?: ""}", e)
        } ?: throw ProjectCopyException("$source: is empty")

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
