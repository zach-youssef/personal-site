// The seam carver's web engines and their golden oracle. Run with the backend's wrapper:
//   ../graphql-server/gradlew -p seamcarver-web check                         the goldens
//   ../graphql-server/gradlew -p seamcarver-web buildWasmGC generateJavaScript  the Java for the browser
// See "Seam carver goldens" and "Seam carver in the browser" in README.md.

import org.teavm.gradle.api.JSModuleType

plugins {
    java
    id("org.teavm") version "0.17.0"
}

repositories {
    mavenCentral()
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

// The SeamCarving submodule, compiled as it is: the oracle that every other engine must match
val seamCarvingSources = layout.projectDirectory.dir("../graphql-server/src/java")
val goldensDir = layout.projectDirectory.dir("../testdata/seamcarver")

val oracle: SourceSet by sourceSets.creating {
    java.srcDirs("src/oracle/java", seamCarvingSources)
}

// The browser build (the main source set, which TeaVM compiles): the same SeamCarving Java, copied
// by transformSeamCarving with its one AWT import pointed at the shim, plus src/main/java: the
// shim (shim.awt.Color), the three boundary classes that replace the ones built on BufferedImage,
// ImageIO and File, and WebCarver, the exported interface. The sources in the submodule are never
// edited.
val boundaryFiles = listOf("FromFileImage.java", "ComputedPixelImage.java", "WorldImage.java")
val awtImport = "import java.awt.*;"
val shimImport = "import shim.awt.*;"

val transformSeamCarving by tasks.registering {
    description = "Copies the SeamCarving Java for the browser build, with its AWT import pointed at the shim"
    val sources = seamCarvingSources.dir("SeamCarving")
    val generated = layout.buildDirectory.dir("generated/seamcarving")
    inputs.dir(sources).withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.property("boundaryFiles", boundaryFiles)
    inputs.property("rewrite", "$awtImport -> $shimImport")
    outputs.dir(generated)
    doLast {
        val outDir = generated.get().dir("SeamCarving").asFile
        outDir.deleteRecursively()
        outDir.mkdirs()
        val problems = mutableListOf<String>()
        val files = sources.asFile.listFiles { f -> f.isFile && f.name.endsWith(".java") }
            ?.sortedBy { it.name } ?: emptyList()
        if (files.isEmpty()) {
            throw GradleException("No SeamCarving sources in ${sources.asFile}: run git submodule update --init graphql-server/src/java/SeamCarving")
        }
        val names = files.map { it.name }
        boundaryFiles.filter { it !in names }.forEach { problems += "src/main/java replaces $it, which the submodule no longer has" }
        val rewritten = mutableListOf<String>()
        // Guards against the submodule growing a dependency the shim doesn't cover: a change there
        // must surface here, as a build error, rather than as a miscompiled or misbehaving engine
        val forbidden = listOf("java.awt", "javax.", "java.io.File")
        for (file in files) {
            if (file.name in boundaryFiles) continue
            val text = file.readText()
            val count = text.split(awtImport).size - 1
            if (count > 0) rewritten += file.name
            if (count > 1) problems += "${file.name} imports java.awt.* $count times"
            val copy = text.replace(awtImport, shimImport)
            forbidden.filter { copy.contains(it) }.forEach { problems += "${file.name} mentions $it, which the browser build has no shim for" }
            File(outDir, file.name).writeText(copy)
        }
        if (rewritten != listOf("Pixel.java")) {
            problems += "expected exactly Pixel.java to import java.awt.*, found ${rewritten.ifEmpty { listOf("none") }}"
        }
        if (problems.isNotEmpty()) {
            throw GradleException("The SeamCarving sources no longer fit the browser build's shim:\n  " + problems.joinToString("\n  "))
        }
    }
}

sourceSets.main {
    java.srcDir(transformSeamCarving)
}

// The tests check the oracle, not the browser build, whose classes have the same names
sourceSets.test {
    compileClasspath = oracle.output + configurations.testCompileClasspath.get()
    runtimeClasspath = output + oracle.output + configurations.testRuntimeClasspath.get()
}

dependencies {
    implementation(teavm.libs.jsoApis)
    testImplementation(platform("org.junit:junit-bom:5.13.4"))
    testImplementation("org.junit.jupiter:junit-jupiter")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

// Both outputs land in build/generated/teavm/{wasm-gc,js}; ./build-seamcarver copies them into the
// backend's assets after checking them against the goldens (golden-check.mjs)
teavm {
    all {
        mainClass = "SeamCarving.WebCarver"
    }
    // The WebAssembly GC build (needs WasmGC and exnref: Chrome 137, Firefox 131, Safari 18.4), with
    // its loader, carver.wasm-runtime.js, as an ES module
    wasmGC {
        addedToWebApp = false
        targetFileName = "carver.wasm"
        modularRuntime = true
    }
    // The JavaScript build, for browsers without those: an ES module with the same exports
    js {
        addedToWebApp = false
        targetFileName = "carver.js"
        moduleType = JSModuleType.ES2015
        obfuscated = true
    }
}

// Regenerates the committed goldens from the oracle: only when the Java changes, or a fixture is added
val writeGoldens by tasks.registering(JavaExec::class) {
    description = "Writes testdata/seamcarver from the SeamCarving oracle"
    classpath = oracle.runtimeClasspath
    mainClass = "GoldenWriter"
    args(goldensDir.asFile.absolutePath)
}

tasks.test {
    useJUnitPlatform()
    systemProperty("goldens.dir", goldensDir.asFile.absolutePath)
    inputs.dir(goldensDir).withPathSensitivity(PathSensitivity.RELATIVE)
    // -Pgoldens.write=true regenerates the goldens first, so the test then checks what it wrote
    if (providers.gradleProperty("goldens.write").orNull == "true") {
        dependsOn(writeGoldens)
    }
    testLogging {
        events("failed")
        exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
    }
}
