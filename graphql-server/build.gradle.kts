import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

val logback_version: String by project
val ktor_version: String by project
val KGraphQLVersion: String by project

plugins {
    application
    // The one place the Kotlin version is set: the plugin adds the matching kotlin-stdlib, and
    // kotlin("reflect") below takes it too. A literal, so Dependabot can update it.
    kotlin("jvm") version "2.4.21"
}

group = "com.zyoussef"
version = "0.0.1-SNAPSHOT"

application {
    mainClass = "io.ktor.server.netty.EngineMain"
}

tasks {
    val fatJar = register<Jar>("fatJar") {
        dependsOn.addAll(listOf("compileJava", "compileKotlin", "processResources")) // We need this for Gradle optimization to work
        archiveClassifier.set("standalone") // Naming the jar
        duplicatesStrategy = DuplicatesStrategy.EXCLUDE
        manifest { attributes(mapOf("Main-Class" to application.mainClass)) } // Provided we set it up in the application plugin configuration
        val sourcesMain = sourceSets.main.get()
        val contents = configurations.runtimeClasspath.get()
            .map { if (it.isDirectory) it else zipTree(it) } +
                sourcesMain.output
        from(contents)
    }
    build {
        dependsOn(fatJar) // Trigger fat jar creation during build
    }
}

repositories {
    mavenLocal()
    mavenCentral()
}

dependencies {
    // KGraphQL and jackson-module-kotlin use kotlin-reflect, which they would otherwise pull in at
    // an old version of their own (1.8.10) against the newer stdlib; versionless, it follows the plugin
    implementation(kotlin("reflect"))
    implementation("io.ktor:ktor-server-netty:$ktor_version")
    implementation("io.ktor:ktor-server-conditional-headers:$ktor_version")
    implementation("io.ktor:ktor-server-caching-headers:$ktor_version")
    implementation("io.ktor:ktor-server-call-logging:$ktor_version")
    // Ktor 3 logs through SLF4J 2, which logback binds from 1.3 on
    implementation("ch.qos.logback:logback-classic:$logback_version")
    // The maintained fork of KGraphQL (github.com/stuebingerb/KGraphQL); com.apurebase stopped at Ktor 2
    implementation("de.stuebingerb:kgraphql:$KGraphQLVersion")
    implementation("de.stuebingerb:kgraphql-ktor:$KGraphQLVersion")
    // Ktor 1.5.4 and KGraphQL 0.17.8 pull in netty 4.1.63, jackson 2.12.2 and gson 2.8.0, which
    // have published vulnerabilities. These constraints raise them within the same major lines
    // (logback 1.2.13 is set directly in gradle.properties).
    implementation(platform("io.netty:netty-bom:4.1.141.Final"))
    implementation(platform("com.fasterxml.jackson:jackson-bom:2.18.12"))
    constraints {
        implementation("com.google.code.gson:gson:2.15.0")
    }
    // Reads the site copy (resources/content/projects.yaml); versions come from the jackson BOM above
    implementation("com.fasterxml.jackson.dataformat:jackson-dataformat-yaml")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    testImplementation("io.ktor:ktor-server-test-host:$ktor_version")
    testImplementation(kotlin("test-junit"))
    // Version comes from the jackson BOM above
    testImplementation("com.fasterxml.jackson.core:jackson-databind")
}

tasks.test {
    testLogging {
        events("failed")
        exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
    }
}


sourceSets.main {
    java.srcDir("src/java")
}

kotlin.sourceSets["main"].kotlin.srcDirs("src")
kotlin.sourceSets["test"].kotlin.srcDirs("test")

sourceSets["main"].resources.srcDirs("resources")
sourceSets["test"].resources.srcDirs("testresources")

kotlin {
    jvmToolchain(21)
}