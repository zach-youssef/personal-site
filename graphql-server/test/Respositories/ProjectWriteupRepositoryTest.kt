package com.zyoussef.Respositories

import com.zyoussef.Content.Article
import com.zyoussef.Content.ProjectWriteup
import com.zyoussef.Content.WriteupSection
import com.zyoussef.Models.ProjectInfo.ProjectCategory
import com.zyoussef.Models.ProjectInfo.ProjectId
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
        ProjectWriteup(id, "context", "alt", listOf(WriteupSection(null, listOf("p"))), listOf(Article("t", "s", null, "https://example.com", "n")))

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
    fun `every write-up has context, alt text and a body`() {
        for (writeup in writeups) {
            assertTrue(writeup.context.isNotBlank(), writeup.id)
            assertTrue(writeup.imageAlt.isNotBlank(), writeup.id)
            assertTrue(writeup.sections.isNotEmpty(), writeup.id)
            for (section in writeup.sections) {
                assertTrue(section.heading?.isNotBlank() ?: true, writeup.id)
                assertTrue(section.paragraphs.isNotEmpty() && section.paragraphs.all { it.isNotBlank() && '\n' !in it }, writeup.id)
            }
        }
    }

    @Test
    fun `every write-up has articles with https urls, real dates and one-line notes`() {
        for (writeup in writeups) {
            assertTrue(writeup.articles.isNotEmpty(), writeup.id)
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
}
