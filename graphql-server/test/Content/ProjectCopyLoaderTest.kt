package com.zyoussef.Content

import com.zyoussef.Models.ProjectInfo.ProjectId
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class ProjectCopyLoaderTest {
    private fun entry(id: String, title: String = "Title of $id") =
        "$id:\n  title: $title\n  description: About $id\n  thumbnail: /assets/$id.webp\n"

    // A valid document with an entry for every project, plus `extra` appended
    private fun document(skip: Set<String> = emptySet(), extra: String = "") =
        ProjectId.entries.filter { it.id !in skip }.joinToString("") { entry(it.id) } + extra

    private fun failure(yaml: String): String =
        assertFailsWith<ProjectCopyException> { ProjectCopyLoader.parse(yaml, "test.yaml") }.message!!

    @Test
    fun `parses an entry for every project`() {
        val copy = ProjectCopyLoader.parse(document(), "test.yaml")
        assertEquals(ProjectId.entries, copy.keys.toList())
        assertEquals(ProjectCopy("Title of zgal", "About zgal", "/assets/zgal.webp"), copy[ProjectId.zgal])
    }

    @Test
    fun `the site's copy is valid`() {
        assertEquals(ProjectId.entries, ProjectCopyLoader.fromResource().keys.toList())
    }

    @Test
    fun `refuses malformed YAML`() {
        val message = failure(document() + "zgal: [unclosed\n")
        assertContains(message, "test.yaml: ")
        assertContains(message, "line ")
    }

    @Test
    fun `refuses an empty document`() {
        assertContains(failure(""), "test.yaml: ")
        assertContains(failure("# only a comment\n"), "test.yaml: ")
    }

    @Test
    fun `refuses a document that isn't a map`() {
        assertContains(failure("- sokoban\n- zgal\n"), "test.yaml: ")
    }

    @Test
    fun `refuses a missing project`() {
        assertEquals("test.yaml: no entry for [zgal, splats]", failure(document(skip = setOf("zgal", "splats"))))
    }

    @Test
    fun `refuses a key that isn't a project`() {
        assertEquals(
            "test.yaml: unknown project ids [zGal] (projects are listed in ProjectId)",
            failure(document(skip = setOf("zgal"), extra = entry("zGal"))).substringBefore("; "),
        )
        assertEquals(
            "test.yaml: unknown project ids [ZGAL] (projects are listed in ProjectId)",
            failure(document(extra = entry("ZGAL"))),
        )
    }

    @Test
    fun `refuses a duplicate project`() {
        assertContains(failure(document(extra = entry("zgal", title = "Again"))), "Duplicate field 'zgal'")
    }

    @Test
    fun `refuses a second document`() {
        failure(document() + "---\n" + entry("zgal", title = "Again"))
    }

    @Test
    fun `refuses an unknown field`() {
        assertContains(failure(document().replace("  title: Title of zgal\n", "  title: Title of zgal\n  subtitle: x\n")), "subtitle")
    }

    @Test
    fun `refuses a duplicate field`() {
        assertContains(failure(document().replace("  title: Title of zgal\n", "  title: Title of zgal\n  title: Again\n")), "Duplicate field 'title'")
    }

    @Test
    fun `refuses a missing field`() {
        for (field in listOf("title", "description", "thumbnail")) {
            val yaml = document().lines().filterNot { it.startsWith("  $field: ") && it.contains("zgal") }.joinToString("\n")
            assertContains(failure(yaml), field, message = field)
        }
    }

    @Test
    fun `refuses a null field`() {
        assertContains(failure(document().replace("  title: Title of zgal\n", "  title:\n")), "title")
    }

    @Test
    fun `refuses a blank field`() {
        assertEquals("test.yaml: zgal: description is blank", failure(document().replace("  description: About zgal\n", "  description: \" \"\n")))
    }

    @Test
    fun `refuses an entry that isn't a map`() {
        assertContains(failure(document().replace(entry("zgal"), "zgal: ZGAL\n")), "test.yaml: ")
    }

    @Test
    fun `refuses a thumbnail that isn't root-relative`() {
        assertEquals(
            "test.yaml: zgal: thumbnail must be a root-relative URL starting with /",
            failure(document().replace("/assets/zgal.webp", "assets/zgal.webp")),
        )
    }

    @Test
    fun `refuses unquoted values YAML reads as booleans or numbers`() {
        // They would otherwise become the text "true" or "2024"
        for (value in listOf("yes", "2024")) {
            val message = failure(document().replace("  title: Title of zgal\n", "  title: $value\n"))
            assertContains(message, "zgal.title must be quoted text")
            assertContains(message, "(line ")
        }
        assertEquals("yes", ProjectCopyLoader.parse(document().replace("  title: Title of zgal\n", "  title: \"yes\"\n"), "test.yaml")[ProjectId.zgal]!!.title)
    }
}
