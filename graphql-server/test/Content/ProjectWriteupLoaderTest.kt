package com.zyoussef.Content

import com.zyoussef.Models.ProjectInfo.ProjectId
import java.io.File
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class ProjectWriteupLoaderTest {
    private val article = """
        |  - title: A headline
        |    source: A Publisher
        |    date: "2024-09"
        |    url: https://example.com/article
        |    note: What it covers
        |""".trimMargin()

    // A valid write-up, with `replace`'s pairs replaced in it
    private fun document(vararg replace: Pair<String, String>): String {
        var yaml = """
            |context: An employer, 2024, a role
            |imageAlt: A picture
            |sections:
            |  - text: |
            |      First paragraph.
            |  - heading: A heading
            |    text: |
            |      Second paragraph.
            |articles:
            |""".trimMargin() + article
        for ((old, new) in replace) {
            assertContains(yaml, old)
            yaml = yaml.replace(old, new)
        }
        return yaml
    }

    private fun parse(yaml: String) = ProjectWriteupLoader.parse(ProjectId.broadAR, yaml, "test.yaml")

    private fun failure(yaml: String): String =
        assertFailsWith<ProjectCopyException> { parse(yaml) }.message!!.also { assertContains(it, "test.yaml: ") }

    @Test
    fun `parses a write-up`() {
        assertEquals(
            ProjectWriteup(
                id = "broadAR",
                context = "An employer, 2024, a role",
                imageAlt = "A picture",
                video = null,
                sections = listOf(WriteupSection(null, listOf("First paragraph.")), WriteupSection("A heading", listOf("Second paragraph."))),
                links = emptyList(),
                articles = listOf(Article("A headline", "A Publisher", "2024-09", "https://example.com/article", "What it covers")),
            ),
            parse(document()),
        )
    }

    @Test
    fun `the site's write-ups are valid, one for each professional project and those listed`() {
        assertEquals(listOf(ProjectId.broadAR, ProjectId.metaAvatars), ProjectWriteupLoader.PROJECTS)
        val writeups = ProjectWriteupLoader.fromResources()
        assertEquals(ProjectWriteupLoader.PROJECTS, writeups.keys.toList())
        for ((id, writeup) in writeups) assertEquals(id.id, writeup.id)
    }

    @Test
    fun `the source directory holds a write-up for no other project`() {
        // The loader reads files by id, so it would never see a stray or misnamed one
        val files = File("resources/${ProjectWriteupLoader.DIRECTORY}").listFiles()!!.map { it.name }.sorted()
        assertEquals(ProjectWriteupLoader.PROJECTS.map { "${it.id}.yaml" }.sorted(), files)
    }

    @Test
    fun `refuses a missing file`() {
        val e = assertFailsWith<ProjectCopyException> { ContentYaml.resourceText("content/writeups/sokoban.yaml") }
        assertEquals("content/writeups/sokoban.yaml: not found on the classpath", e.message)
    }

    @Test
    fun `splits text into paragraphs on blank lines`() {
        assertEquals(
            listOf("One line.", "Hard wrapped across lines and indented.", "After a blank line holding spaces."),
            ProjectWriteupLoader.paragraphs("\n\nOne line.\n\n\nHard wrapped\n  across lines\n\tand   indented.\n  \t \nAfter a blank line\nholding spaces.\n\n"),
        )
        assertEquals(listOf("Windows line endings."), ProjectWriteupLoader.paragraphs("Windows\r\nline endings.\r\n\r\n"))
        assertEquals(emptyList(), ProjectWriteupLoader.paragraphs(" \n\n \n"))
    }

    @Test
    fun `a block scalar's paragraphs become the section's`() {
        val writeup = parse(document("      First paragraph.\n" to "      One\n      wrapped.\n\n      Two.\n\n\n      Three.\n"))
        assertEquals(listOf("One wrapped.", "Two.", "Three."), writeup.sections[0].paragraphs)
    }

    @Test
    fun `refuses malformed YAML`() {
        assertContains(failure(document() + "sections: [unclosed\n"), "line ")
    }

    @Test
    fun `refuses an empty document or one that isn't a map`() {
        failure("")
        failure("# only a comment\n")
        failure("- context\n")
    }

    @Test
    fun `refuses a second document`() {
        failure(document() + "---\n" + document())
    }

    @Test
    fun `refuses unknown fields`() {
        assertContains(failure(document("imageAlt: A picture\n" to "imageAlt: A picture\ntitle: x\n")), "title")
        assertContains(failure(document("  - heading: A heading\n" to "  - heading: A heading\n    subtitle: x\n")), "subtitle")
        assertContains(failure(document("    note: What it covers\n" to "    note: What it covers\n    author: x\n")), "author")
    }

    @Test
    fun `refuses duplicate fields`() {
        assertContains(failure(document("imageAlt: A picture\n" to "imageAlt: A picture\nimageAlt: Again\n")), "Duplicate field 'imageAlt'")
        assertContains(failure(document("    source: A Publisher\n" to "    source: A Publisher\n    source: Again\n")), "Duplicate field 'source'")
    }

    @Test
    fun `refuses a missing field`() {
        val removals = listOf(
            "context" to ("context: An employer, 2024, a role\n" to ""),
            "imageAlt" to ("imageAlt: A picture\n" to ""),
            "text" to ("    text: |\n      Second paragraph.\n" to ""),
            "title" to ("  - title: A headline\n    source" to "  - source"),
            "source" to ("    source: A Publisher\n" to ""),
            "url" to ("    url: https://example.com/article\n" to ""),
            "note" to ("    note: What it covers\n" to ""),
        )
        for ((field, removal) in removals) {
            assertContains(failure(document(removal)), field, message = field)
        }
        assertContains(failure(document("sections:\n" to "", "  - text: |\n      First paragraph.\n" to "", "  - heading: A heading\n    text: |\n      Second paragraph.\n" to "")), "sections")
    }

    @Test
    fun `refuses a blank or null field`() {
        assertEquals("test.yaml: context is blank", failure(document("context: An employer, 2024, a role" to "context: \" \"")))
        assertEquals("test.yaml: imageAlt is blank", failure(document("imageAlt: A picture" to "imageAlt: \"\"")))
        assertEquals("test.yaml: sections[1].heading is blank", failure(document("heading: A heading" to "heading: \" \"")))
        assertEquals("test.yaml: sections[0].text is blank", failure(document("  - text: |\n      First paragraph.\n" to "  - text: \"\\n\\n\"\n")))
        assertEquals("test.yaml: articles[0].title is blank", failure(document("title: A headline" to "title: \"\"")))
        assertEquals("test.yaml: articles[0].source is blank", failure(document("source: A Publisher" to "source: \"\"")))
        assertEquals("test.yaml: articles[0].note is blank", failure(document("note: What it covers" to "note: \" \"")))
        assertContains(failure(document("url: https://example.com/article" to "url: \"\"")), "articles[0].url is blank")
        failure(document("context: An employer, 2024, a role" to "context:"))
        failure(document("title: A headline" to "title:"))
    }

    @Test
    fun `a heading and a date are optional`() {
        val writeup = parse(document("    date: \"2024-09\"\n" to ""))
        assertEquals(null, writeup.sections[0].heading)
        assertEquals(null, writeup.articles[0].date)
    }

    @Test
    fun `refuses no sections or no articles`() {
        assertEquals("test.yaml: sections is empty", failure(document(
            "sections:\n  - text: |\n      First paragraph.\n  - heading: A heading\n    text: |\n      Second paragraph.\n" to "sections: []\n")))
        assertEquals("test.yaml: articles is empty (remove it for none)", failure(document("articles:\n$article" to "articles: []\n")))
        assertEquals("test.yaml: articles is empty (remove it for none)", failure(document("articles:\n$article" to "articles:\n")))
    }

    @Test
    fun `articles are optional`() {
        assertEquals(emptyList(), parse(document("articles:\n$article" to "")).articles)
    }

    private val video = "video:\n  youtubeId: Q0pc37MOsxI\n  title: A demo\n"

    @Test
    fun `a video takes the image's place`() {
        val writeup = parse(document("imageAlt: A picture\n" to video))
        assertEquals(WriteupVideo("Q0pc37MOsxI", "A demo"), writeup.video)
        assertEquals(null, writeup.imageAlt)
    }

    @Test
    fun `refuses neither an image's alt text nor a video, or both`() {
        assertEquals("test.yaml: imageAlt is missing (or a video, to show in place of the image)", failure(document("imageAlt: A picture\n" to "")))
        assertEquals("test.yaml: imageAlt and video are both given, but a video replaces the image", failure(document("imageAlt: A picture\n" to "imageAlt: A picture\n$video")))
    }

    @Test
    fun `refuses a video without a YouTube id or a title`() {
        for (id in listOf("Q0pc37MOsx", "Q0pc37MOsxIx", "Q0pc37MOs/I", "https://youtu.be/Q0pc37MOsxI", "\"\"")) {
            assertEquals(
                "test.yaml: video.youtubeId must be the 11-character id in the video's URL",
                failure(document("imageAlt: A picture\n" to video.replace("Q0pc37MOsxI", id))),
                id,
            )
        }
        assertEquals("test.yaml: video.title is blank", failure(document("imageAlt: A picture\n" to video.replace("A demo", "\" \""))))
        assertContains(failure(document("imageAlt: A picture\n" to video.replace("  title: A demo\n", ""))), "title")
        assertContains(failure(document("imageAlt: A picture\n" to video + "  poster: x\n")), "poster")
    }

    private val figure = "    figures:\n      - src: /assets/writeups/broadAR/a-diagram.svg\n        alt: What it shows\n        caption: Under it\n"
    private fun withFigure(replace: String = "", with: String = "") =
        document("      Second paragraph.\n" to "      Second paragraph.\n" + figure.replace(replace, with))

    @Test
    fun `a section's figures follow its paragraphs`() {
        val writeup = parse(withFigure())
        assertEquals(emptyList(), writeup.sections[0].figures)
        assertEquals(listOf(WriteupFigure("/assets/writeups/broadAR/a-diagram.svg", "What it shows", "Under it")), writeup.sections[1].figures)
    }

    @Test
    fun `refuses a figure that isn't an SVG under the write-ups' assets`() {
        for (src in listOf(
            "/assets/projectThumbnail/a.svg", "/assets/writeups/a.png", "assets/writeups/a.svg", "/assets/writeups/../a.svg",
            "/assets/writeups/./a.svg", "/assets/writeups//a.svg", "https://example.com/assets/writeups/a.svg", "/assets/writeups/a.svg?x",
        )) {
            assertEquals(
                "test.yaml: sections[1].figures[0].src must be an SVG under /assets/writeups/, such as /assets/writeups/broadAR/diagram.svg",
                failure(withFigure("/assets/writeups/broadAR/a-diagram.svg", src)),
                src,
            )
        }
        parse(withFigure("/assets/writeups/broadAR/a-diagram.svg", "/assets/writeups/a_b.svg"))
    }

    @Test
    fun `refuses a figure without alt text or a caption, or an empty figures list`() {
        assertEquals("test.yaml: sections[1].figures[0].alt is blank", failure(withFigure("alt: What it shows", "alt: \" \"")))
        assertEquals("test.yaml: sections[1].figures[0].caption is blank", failure(withFigure("caption: Under it", "caption: \"\"")))
        assertContains(failure(withFigure("        caption: Under it\n", "")), "caption")
        assertContains(failure(withFigure("        caption: Under it\n", "        caption: Under it\n        width: 3\n")), "width")
        assertEquals("test.yaml: sections[1].figures[0] is empty", failure(withFigure(figure.substringAfter("figures:\n"), "      -\n")))
        assertEquals("test.yaml: sections[1].figures is empty (remove it for none)", failure(withFigure(figure.substringAfter("figures:\n"), "")))
        assertEquals("test.yaml: sections[1].figures is empty (remove it for none)", failure(withFigure(figure.substringAfter("figures:"), " []\n")))
    }

    private val links = "links:\n  - title: The code\n    url: https://github.com/example/repo\n"

    @Test
    fun `links are optional, each a title and an https url`() {
        assertEquals(listOf(WriteupLink("The code", "https://github.com/example/repo")), parse(document("articles:\n" to links + "articles:\n")).links)
        assertEquals(
            "test.yaml: links[0].url must start with https://",
            failure(document("articles:\n" to links.replace("https://", "http://") + "articles:\n")),
        )
        assertEquals("test.yaml: links[0].title is blank", failure(document("articles:\n" to links.replace("The code", "\"\"") + "articles:\n")))
        assertEquals("test.yaml: links[0].url is blank", failure(document("articles:\n" to links.replace("https://github.com/example/repo", "\"\"") + "articles:\n")))
        assertEquals("test.yaml: links is empty (remove it for none)", failure(document("articles:\n" to "links: []\narticles:\n")))
        assertEquals("test.yaml: links[0] is empty", failure(document("articles:\n" to "links:\n  -\narticles:\n")))
    }

    @Test
    fun `refuses a url that isn't https`() {
        for (url in listOf("http://example.com", "example.com", "/assets/article", "ftp://example.com")) {
            assertEquals("test.yaml: articles[0].url must start with https://", failure(document("https://example.com/article" to url)), url)
        }
    }

    @Test
    fun `accepts real dates as YYYY-MM or YYYY-MM-DD`() {
        for (date in listOf("2024-09", "2024-12", "2024-09-25", "2024-02-29")) {
            assertEquals(date, parse(document("\"2024-09\"" to "\"$date\"")).articles[0].date)
        }
    }

    @Test
    fun `refuses a date that isn't a real YYYY-MM or YYYY-MM-DD`() {
        for (date in listOf("2024", "2024-13", "2024-00", "2024-9", "2024-09-31", "2023-02-29", "2024-09-00", "Sep 2024", "2024-09-25T10:00", " 2024-09", "")) {
            assertEquals(
                "test.yaml: articles[0].date must be a real date as YYYY-MM or YYYY-MM-DD",
                failure(document("\"2024-09\"" to "\"$date\"")),
                date,
            )
        }
    }

    @Test
    fun `an unquoted date is read as the same text`() {
        // YAML 1.1 reads some unquoted dates as timestamps; the loader must see the text as written
        assertEquals("2024-09", parse(document("\"2024-09\"" to "2024-09")).articles[0].date)
        assertEquals("2024-09-25", parse(document("\"2024-09\"" to "2024-09-25")).articles[0].date)
    }

    @Test
    fun `refuses unquoted values YAML reads as booleans or numbers`() {
        // These would otherwise become "true", "false", "2024" or "3.1"
        for (value in listOf("yes", "no", "on", "off", "true", "2024", "3.10")) {
            // Names the field and the line, and tells the editor to quote it
            val message = failure(document("note: What it covers" to "note: $value"))
            assertContains(message, "articles[0].note must be quoted text")
            assertContains(message, "(line 14, column")
        }
        assertEquals("yes", parse(document("note: What it covers" to "note: \"yes\"")).articles[0].note)
    }

    @Test
    fun `refuses an empty list item`() {
        assertEquals("test.yaml: sections[1] is empty", failure(document("  - heading: A heading\n    text: |\n      Second paragraph.\n" to "  -\n")))
        assertEquals("test.yaml: articles[0] is empty", failure(document(article to "  -\n")))
    }

    @Test
    fun `refuses an empty heading`() {
        assertEquals("test.yaml: sections[1].heading is empty (remove it for a section without one)", failure(document("heading: A heading" to "heading:")))
        assertEquals("test.yaml: sections[1].heading is empty (remove it for a section without one)", failure(document("heading: A heading" to "heading: ~")))
    }

    @Test
    fun `refuses a note with a line break`() {
        assertEquals("test.yaml: articles[0].note must be one line", failure(document("note: What it covers" to "note: \"Two\\nlines\"")))
        assertEquals("test.yaml: articles[0].note must be one line", failure(document("note: What it covers" to "note: |\n      Two\n      lines")))
        // A plain scalar wrapped across lines is folded into one
        assertEquals("What it covers", parse(document("note: What it covers" to "note: What it\n      covers")).articles[0].note)
    }

    @Test
    fun `names every problem at once`() {
        val message = failure(document("imageAlt: A picture" to "imageAlt: \"\"", "https://example.com/article" to "http://example.com"))
        assertTrue(message.contains("imageAlt is blank") && message.contains("url must start with https://"), message)
    }
}
