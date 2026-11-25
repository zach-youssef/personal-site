package com.zyoussef.Content

import com.fasterxml.jackson.core.JacksonException
import com.fasterxml.jackson.core.StreamReadFeature
import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.cfg.CoercionAction
import com.fasterxml.jackson.databind.cfg.CoercionInputShape
import com.fasterxml.jackson.databind.exc.MismatchedInputException
import com.fasterxml.jackson.databind.type.LogicalType
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper
import com.fasterxml.jackson.module.kotlin.kotlinModule

// Invalid site copy: names the file and what's wrong with it. The server refuses to start on it.
class ProjectCopyException(message: String, cause: Throwable? = null) : IllegalStateException(message, cause)

// Reads the site's copy (resources/content/), the same strict way for every file
object ContentYaml {
    private val mapper = YAMLMapper.builder()
        .addModule(kotlinModule())
        // A repeated key would otherwise silently replace the first entry
        .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
        .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
        // A second `---` document would otherwise be ignored without a word
        .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
        // YAML reads an unquoted `yes`, `off` or `3.10` as a boolean or number, which would
        // otherwise become the text "true", "false" or "3.1": refused, so it gets quoted
        .withCoercionConfig(LogicalType.Textual) {
            it.setCoercion(CoercionInputShape.Boolean, CoercionAction.Fail)
            it.setCoercion(CoercionInputShape.Integer, CoercionAction.Fail)
            it.setCoercion(CoercionInputShape.Float, CoercionAction.Fail)
        }
        .build()

    // A classpath resource's text, so it works from the fat jar as well as from the source tree
    fun resourceText(resource: String): String {
        val stream = ContentYaml::class.java.classLoader.getResourceAsStream(resource)
            ?: throw ProjectCopyException("$resource: not found on the classpath")
        return stream.use { it.readBytes().decodeToString() }
    }

    // Parses `yaml` as a T. Throws ProjectCopyException naming `source` and the line on a syntax
    // error, an unknown, repeated or missing field, or a value of the wrong type, and if it's empty.
    fun <T : Any> parse(yaml: String, source: String, type: TypeReference<T?>): T = try {
        mapper.readValue(yaml, type)
    } catch (e: MismatchedInputException) {
        val at = e.location?.let { " (line ${it.lineNr}, column ${it.columnNr})" } ?: ""
        if (e.originalMessage.startsWith("Cannot coerce")) {
            // Jackson's own message points at its configuration, not at the file
            throw ProjectCopyException("$source: ${fieldPath(e)} must be quoted text, as YAML reads it as a number or a boolean$at", e)
        }
        throw ProjectCopyException("$source: ${e.originalMessage}$at", e)
    } catch (e: JacksonException) {
        throw ProjectCopyException("$source: ${e.originalMessage}${e.location?.let { " (line ${it.lineNr}, column ${it.columnNr})" } ?: ""}", e)
    } ?: throw ProjectCopyException("$source: is empty")

    // The path to the offending value, such as `articles[0].note`
    private fun fieldPath(e: MismatchedInputException): String =
        e.path.fold("") { path, ref ->
            when {
                ref.fieldName != null -> if (path.isEmpty()) ref.fieldName else "$path.${ref.fieldName}"
                else -> "$path[${ref.index}]"
            }
        }.ifEmpty { "the value" }
}
