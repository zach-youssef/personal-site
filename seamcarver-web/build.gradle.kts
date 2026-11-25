// The seam carver's web engines and their golden oracle. Run with the backend's wrapper:
//   ../graphql-server/gradlew -p seamcarver-web check
// See "Seam carver goldens" in README.md.

plugins {
    java
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

sourceSets.test {
    compileClasspath += oracle.output
    runtimeClasspath += oracle.output
}

dependencies {
    testImplementation(platform("org.junit:junit-bom:5.13.4"))
    testImplementation("org.junit.jupiter:junit-jupiter")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
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
