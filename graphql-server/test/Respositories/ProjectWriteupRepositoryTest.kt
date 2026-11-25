package com.zyoussef.Respositories

import com.zyoussef.Content.Article
import com.zyoussef.Content.ProjectWriteup
import com.zyoussef.Content.WriteupSection
import com.zyoussef.Models.ProjectInfo.ProjectCategory
import com.zyoussef.Models.ProjectInfo.ProjectId
import java.io.File
import java.time.LocalDate
import java.time.YearMonth
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

// The site's write-ups, as the backend serves them
class ProjectWriteupRepositoryTest {
    private val repository = ProjectWriteupRepository.fromResource()
    private val writeups = repository.getAllWriteups()

    private fun writeup(id: String) =
        ProjectWriteup(id, "context", "alt", null, listOf(WriteupSection(null, listOf("p"))), emptyList(), listOf(Article("t", "s", null, "https://example.com", "n")))

    @Test
    fun `every professional project has a write-up, and every write-up is a professional project's`() {
        val professional = SimpleProjectInfoRepository.fromResource().getAllProjects(category = ProjectCategory.PROFESSIONAL).map { it.id }
        assertEquals(listOf("broadAR", "metaAvatars"), professional)
        assertEquals(professional, writeups.map { it.id })
    }

    @Test
    fun `ids are unique and each write-up is keyed by its id`() {
        assertEquals(writeups.size, writeups.map { it.id }.toSet().size)
        for (writeup in writeups) {
            assertEquals(writeup, repository.getWriteup(ProjectId.fromId(writeup.id)!!))
        }
    }

    @Test
    fun `is null for a project without a write-up`() {
        for (id in ProjectId.entries.filter { it.category != ProjectCategory.PROFESSIONAL }) {
            assertNull(repository.getWriteup(id), id.id)
        }
    }

    @Test
    fun `refuses a write-up keyed by another project's id`() {
        val e = assertFailsWith<IllegalArgumentException> { ProjectWriteupRepository(mapOf(ProjectId.broadAR to writeup("metaAvatars"))) }
        assertEquals("Write-up metaAvatars is keyed as broadAR", e.message)
    }

    @Test
    fun `keeps ProjectId order`() {
        val repository = ProjectWriteupRepository(mapOf(ProjectId.metaAvatars to writeup("metaAvatars"), ProjectId.broadAR to writeup("broadAR")))
        assertEquals(listOf("broadAR", "metaAvatars"), repository.getAllWriteups().map { it.id })
    }

    @Test
    fun `every write-up has context, an image's alt text or a video, and a body`() {
        for (writeup in writeups) {
            assertTrue(writeup.context.isNotBlank(), writeup.id)
            assertTrue((writeup.imageAlt == null) != (writeup.video == null), writeup.id)
            writeup.imageAlt?.let { assertTrue(it.isNotBlank(), writeup.id) }
            writeup.video?.let { assertTrue(Regex("[A-Za-z0-9_-]{11}").matches(it.youtubeId) && it.title.isNotBlank(), writeup.id) }
            assertTrue(writeup.sections.isNotEmpty(), writeup.id)
            for (section in writeup.sections) {
                assertTrue(section.heading?.isNotBlank() ?: true, writeup.id)
                assertTrue(section.paragraphs.isNotEmpty() && section.paragraphs.all { it.isNotBlank() && '\n' !in it }, writeup.id)
            }
        }
    }

    @Test
    fun `every figure is an SVG the backend serves, with alt text and a caption`() {
        for (writeup in writeups) {
            for (figure in writeup.sections.flatMap { it.figures }) {
                val at = "${writeup.id}: ${figure.src}"
                // Served from graphql-server/assets/ at /assets/ (the tests run in graphql-server/)
                val file = File(figure.src.removePrefix("/"))
                assertTrue(figure.src.startsWith("/assets/writeups/${writeup.id}/") && file.isFile, at)
                assertTrue(file.readText().trimStart().let { it.startsWith("<svg") || it.startsWith("<?xml") }, at)
                assertTrue(figure.alt.isNotBlank() && figure.caption.isNotBlank(), at)
            }
        }
    }

    @Test
    fun `every write-up links somewhere, over https, and its articles have real dates and one-line notes`() {
        for (writeup in writeups) {
            assertTrue(writeup.articles.isNotEmpty() || writeup.links.isNotEmpty(), writeup.id)
            for (link in writeup.links) {
                assertTrue(link.title.isNotBlank() && link.url.startsWith("https://"), "${writeup.id}: ${link.url}")
            }
            for (article in writeup.articles) {
                val at = "${writeup.id}: ${article.url}"
                assertTrue(article.title.isNotBlank() && article.source.isNotBlank(), at)
                assertTrue(article.url.startsWith("https://"), at)
                article.date?.let { date ->
                    assertTrue(Regex("""\d{4}-\d{2}(-\d{2})?""").matches(date), at)
                    // Throws for a month or day that doesn't exist
                    if (date.length == 7) YearMonth.parse(date) else LocalDate.parse(date)
                }
                assertTrue(article.note.isNotBlank() && '\n' !in article.note && '\r' !in article.note, at)
            }
        }
    }

    // The copy went in with the write-ups; a placeholder must not come back, since every merge to master is deployed
    @Test
    fun `no write-up contains a TODO(copy) placeholder`() {
        for (writeup in writeups) {
            val strings = listOfNotNull(writeup.context, writeup.imageAlt, writeup.video?.title) +
                writeup.sections.flatMap { section ->
                    listOf(section.heading ?: "") + section.paragraphs + section.figures.flatMap { listOf(it.src, it.alt, it.caption) }
                } +
                writeup.links.flatMap { listOf(it.title, it.url) } +
                writeup.articles.flatMap { listOf(it.title, it.source, it.date ?: "", it.url, it.note) }
            for (text in strings) {
                assertTrue("TODO(copy)" !in text, "${writeup.id}: $text")
            }
        }
    }
}
