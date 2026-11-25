package com.zyoussef.Content

import com.fasterxml.jackson.core.type.TypeReference
import com.zyoussef.Models.ProjectInfo.ProjectCategory
import com.zyoussef.Models.ProjectInfo.ProjectId
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeParseException

// A project's page, from resources/content/writeups/<id>.yaml (see the README's "Site copy"). The
// page's title, and its image unless it has a video, are the project's card's (ProjectInfo), so
// they can't drift.
data class ProjectWriteup(
    // The project's id (ProjectId), which names the file
    val id: String,
    // One line under the title: employer, year, role
    val context: String,
    // The alt text of the page's image, the card's thumbnail; null when a video takes its place
    val imageAlt: String?,
    // A video shown in place of the card's image, or null
    val video: WriteupVideo?,
    val sections: List<WriteupSection>,
    // Links to the project itself, such as its repository; may be empty
    val links: List<WriteupLink>,
    // May be empty
    val articles: List<Article>,
)

// A part of the page's body: an optional heading, its paragraphs, then its figures
data class WriteupSection(val heading: String?, val paragraphs: List<String>, val figures: List<WriteupFigure> = emptyList())

// A diagram in a section: an SVG among the backend's assets, which the page draws inline so that it
// takes the site's theme and its text can be selected
data class WriteupFigure(
    // Root-relative: "/assets/writeups/<id>/<name>.svg"
    val src: String,
    // What the diagram shows, for screen readers
    val alt: String,
    // Shown under it
    val caption: String,
)

// A YouTube video, which the page loads from youtube-nocookie.com only once it's clicked
data class WriteupVideo(
    // The 11-character id in the video's URL
    val youtubeId: String,
    // Names it on its poster and to screen readers
    val title: String,
)

// A link to the project itself, shown as a button
data class WriteupLink(val title: String, val url: String)

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

    // The projects whose page is a write-up: the professional ones and those listed here
    private val WRITTEN_UP: Set<ProjectId> = setOf(ProjectId.foundationDbFs)
    val PROJECTS: List<ProjectId> = ProjectId.entries.filter { it.category == ProjectCategory.PROFESSIONAL || it in WRITTEN_UP }

    fun resource(id: ProjectId) = "$DIRECTORY/${id.id}.yaml"

    // Every project's write-up. Throws ProjectCopyException if a file is missing or invalid, so
    // that a mistake in one stops the server from starting rather than showing up on the site.
    fun fromResources(): Map<ProjectId, ProjectWriteup> =
        PROJECTS.associateWith { parse(it, ContentYaml.resourceText(resource(it)), resource(it)) }

    // The file's shape; `text` becomes the section's paragraphs
    // (List items are nullable so that an empty `-` is refused with a message, not an NPE; a
    // heading defaults to NO_HEADING so that an absent one differs from an empty `heading:`)
    // (the optional lists default to ABSENT, like a heading, so that an empty `figures:` is refused)
    private data class WriteupFile(
        val context: String,
        val imageAlt: String? = null,
        val video: WriteupVideo? = null,
        val sections: List<SectionFile?>,
        val links: List<WriteupLink?>? = ABSENT,
        val articles: List<Article?>? = ABSENT,
    )
    private data class SectionFile(val heading: String? = NO_HEADING, val text: String, val figures: List<WriteupFigure?>? = ABSENT)
    private const val NO_HEADING = "\u0000"
    // Compared by identity: a list Jackson reads is always another instance
    private val ABSENT: List<Nothing> = ArrayList(0)

    private val DATE = Regex("""\d{4}-\d{2}(-\d{2})?""")
    private val YOUTUBE_ID = Regex("""[A-Za-z0-9_-]{11}""")
    // A file among the write-ups' assets, by a path without `..` or other surprises
    private val FIGURE_SRC = Regex("""/assets/writeups/[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*\.svg""")

    // `text` as paragraphs: split on blank lines, with the line breaks and indentation inside each
    // paragraph collapsed to single spaces, so a hard-wrapped paragraph reads as one
    fun paragraphs(text: String): List<String> =
        text.split(Regex("""\n[ \t\r]*\n""")).map { it.trim().replace(Regex("""\s+"""), " ") }.filter { it.isNotEmpty() }

    // Parses and checks project `id`'s write-up: either `imageAlt` or a `video`, every field but a
    // heading and a date present and non-blank, a heading non-blank when present, at least one
    // section, the optional lists non-empty when present, https:// URLs, real dates as YYYY-MM or
    // YYYY-MM-DD, one-line notes, YouTube ids and figure paths in their forms. `source` names it in
    // error messages.
    fun parse(id: ProjectId, yaml: String, source: String): ProjectWriteup {
        val file = ContentYaml.parse(yaml, source, object : TypeReference<WriteupFile?>() {})

        val problems = mutableListOf<String>()
        fun nonBlank(field: String, value: String) { if (value.isBlank()) problems += "$field is blank" }
        fun https(field: String, url: String) {
            nonBlank(field, url)
            if (url.isNotBlank() && !url.startsWith("https://")) problems += "$field must start with https://"
        }
        fun notEmpty(field: String, list: List<*>?) { if (list !== ABSENT && list.isNullOrEmpty()) problems += "$field is empty (remove it for none)" }
        nonBlank("context", file.context)
        when {
            file.imageAlt == null && file.video == null -> problems += "imageAlt is missing (or a video, to show in place of the image)"
            file.imageAlt != null && file.video != null -> problems += "imageAlt and video are both given, but a video replaces the image"
            file.imageAlt != null -> nonBlank("imageAlt", file.imageAlt)
        }
        file.video?.let { video ->
            if (!YOUTUBE_ID.matches(video.youtubeId)) problems += "video.youtubeId must be the 11-character id in the video's URL"
            nonBlank("video.title", video.title)
        }
        if (file.sections.isEmpty()) problems += "sections is empty"
        file.sections.forEachIndexed { i, section ->
            if (section == null) { problems += "sections[$i] is empty"; return@forEachIndexed }
            if (section.heading == null) problems += "sections[$i].heading is empty (remove it for a section without one)"
            else if (section.heading != NO_HEADING) nonBlank("sections[$i].heading", section.heading)
            nonBlank("sections[$i].text", section.text)
            notEmpty("sections[$i].figures", section.figures)
            section.figures?.forEachIndexed { j, figure ->
                val at = "sections[$i].figures[$j]"
                if (figure == null) { problems += "$at is empty"; return@forEachIndexed }
                if (!FIGURE_SRC.matches(figure.src)) problems += "$at.src must be an SVG under /assets/writeups/, such as /assets/writeups/${id.id}/diagram.svg"
                nonBlank("$at.alt", figure.alt)
                nonBlank("$at.caption", figure.caption)
            }
        }
        notEmpty("links", file.links)
        file.links?.forEachIndexed { i, link ->
            if (link == null) { problems += "links[$i] is empty"; return@forEachIndexed }
            nonBlank("links[$i].title", link.title)
            https("links[$i].url", link.url)
        }
        notEmpty("articles", file.articles)
        file.articles?.forEachIndexed { i, article ->
            val at = "articles[$i]"
            if (article == null) { problems += "$at is empty"; return@forEachIndexed }
            nonBlank("$at.title", article.title)
            nonBlank("$at.source", article.source)
            https("$at.url", article.url)
            nonBlank("$at.note", article.note)
            if (article.date != null && !isDate(article.date)) problems += "$at.date must be a real date as YYYY-MM or YYYY-MM-DD"
            if (article.note.contains('\n') || article.note.contains('\r')) problems += "$at.note must be one line"
        }
        if (problems.isNotEmpty()) throw ProjectCopyException("$source: ${problems.joinToString("; ")}")

        return ProjectWriteup(
            id = id.id,
            context = file.context,
            imageAlt = file.imageAlt,
            video = file.video,
            sections = file.sections.map { section ->
                section!!.let {
                    WriteupSection(it.heading.takeIf { h -> h != NO_HEADING }, paragraphs(it.text), it.figures.orEmpty().filterNotNull())
                }
            },
            links = file.links.orEmpty().filterNotNull(),
            articles = file.articles.orEmpty().filterNotNull(),
        )
    }

    private fun isDate(date: String): Boolean = DATE.matches(date) && try {
        if (date.length == 7) YearMonth.parse(date) else LocalDate.parse(date)
        true
    } catch (_: DateTimeParseException) {
        false
    }
}
