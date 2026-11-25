package com.zyoussef.Content

import com.fasterxml.jackson.core.type.TypeReference
import com.zyoussef.Models.ProjectInfo.ProjectCategory
import com.zyoussef.Models.ProjectInfo.ProjectId
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeParseException

// A professional project's page, from resources/content/writeups/<id>.yaml (see the README's
// "Site copy"). The page's title and image are the project's card's (ProjectInfo), so they can't drift.
data class ProjectWriteup(
    // The project's id (ProjectId), which names the file
    val id: String,
    // One line under the title: employer, year, role
    val context: String,
    // The alt text of the page's image, the card's thumbnail
    val imageAlt: String,
    val sections: List<WriteupSection>,
    val articles: List<Article>,
)

// A part of the page's body: an optional heading and its paragraphs
data class WriteupSection(val heading: String?, val paragraphs: List<String>)

// An article about the project, shown as a card linking to it
data class Article(
    val title: String,
    // The publisher, such as "The Verge"
    val source: String,
    // When it was published: "YYYY-MM" or "YYYY-MM-DD", or null if unknown
    val date: String?,
    // Where it is, an https:// URL
    val url: String,
    // One line on what it covers
    val note: String,
)

object ProjectWriteupLoader {
    // Read from the classpath, one file per project. A classpath directory can't be listed from
    // the fat jar, so the files are looked up by id rather than discovered.
    const val DIRECTORY = "content/writeups"

    // The projects that have a page of their own, and so a write-up
    val PROJECTS: List<ProjectId> = ProjectId.entries.filter { it.category == ProjectCategory.PROFESSIONAL }

    fun resource(id: ProjectId) = "$DIRECTORY/${id.id}.yaml"

    // Every project's write-up. Throws ProjectCopyException if a file is missing or invalid, so
    // that a mistake in one stops the server from starting rather than showing up on the site.
    fun fromResources(): Map<ProjectId, ProjectWriteup> =
        PROJECTS.associateWith { parse(it, ContentYaml.resourceText(resource(it)), resource(it)) }

    // The file's shape; `text` becomes the section's paragraphs
    // (List items are nullable so that an empty `-` is refused with a message, not an NPE; a
    // heading defaults to NO_HEADING so that an absent one differs from an empty `heading:`)
    private data class WriteupFile(val context: String, val imageAlt: String, val sections: List<SectionFile?>, val articles: List<Article?>)
    private data class SectionFile(val heading: String? = NO_HEADING, val text: String)
    private const val NO_HEADING = "\u0000"

    private val DATE = Regex("""\d{4}-\d{2}(-\d{2})?""")

    // `text` as paragraphs: split on blank lines, with the line breaks and indentation inside each
    // paragraph collapsed to single spaces, so a hard-wrapped paragraph reads as one
    fun paragraphs(text: String): List<String> =
        text.split(Regex("""\n[ \t\r]*\n""")).map { it.trim().replace(Regex("""\s+"""), " ") }.filter { it.isNotEmpty() }

    // Parses and checks project `id`'s write-up: every field but a heading and a date present and
    // non-blank, a heading non-blank when present, at least one section and one article, https://
    // URLs, real dates as YYYY-MM or YYYY-MM-DD, one-line notes. `source` names it in error messages.
    fun parse(id: ProjectId, yaml: String, source: String): ProjectWriteup {
        val file = ContentYaml.parse(yaml, source, object : TypeReference<WriteupFile?>() {})

        val problems = mutableListOf<String>()
        fun nonBlank(field: String, value: String) { if (value.isBlank()) problems += "$field is blank" }
        nonBlank("context", file.context)
        nonBlank("imageAlt", file.imageAlt)
        if (file.sections.isEmpty()) problems += "sections is empty"
        file.sections.forEachIndexed { i, section ->
            if (section == null) { problems += "sections[$i] is empty"; return@forEachIndexed }
            if (section.heading == null) problems += "sections[$i].heading is empty (remove it for a section without one)"
            else if (section.heading != NO_HEADING) nonBlank("sections[$i].heading", section.heading)
            nonBlank("sections[$i].text", section.text)
        }
        if (file.articles.isEmpty()) problems += "articles is empty"
        file.articles.forEachIndexed { i, article ->
            val at = "articles[$i]"
            if (article == null) { problems += "$at is empty"; return@forEachIndexed }
            nonBlank("$at.title", article.title)
            nonBlank("$at.source", article.source)
            nonBlank("$at.url", article.url)
            nonBlank("$at.note", article.note)
            if (article.url.isNotBlank() && !article.url.startsWith("https://")) problems += "$at.url must start with https://"
            if (article.date != null && !isDate(article.date)) problems += "$at.date must be a real date as YYYY-MM or YYYY-MM-DD"
            if (article.note.contains('\n') || article.note.contains('\r')) problems += "$at.note must be one line"
        }
        if (problems.isNotEmpty()) throw ProjectCopyException("$source: ${problems.joinToString("; ")}")

        return ProjectWriteup(
            id = id.id,
            context = file.context,
            imageAlt = file.imageAlt,
            sections = file.sections.map { section ->
                section!!.let { WriteupSection(it.heading.takeIf { h -> h != NO_HEADING }, paragraphs(it.text)) }
            },
            articles = file.articles.filterNotNull(),
        )
    }

    private fun isDate(date: String): Boolean = DATE.matches(date) && try {
        if (date.length == 7) YearMonth.parse(date) else LocalDate.parse(date)
        true
    } catch (_: DateTimeParseException) {
        false
    }
}
