import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

val logback_version: String by project
val ktor_version: String by project
val kotlin_version: String by project
val KGraphQLVersion: String by project

plugins {
    application
    kotlin("jvm") version "2.2.20"
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
    implementation("org.jetbrains.kotlin:kotlin-stdlib-jdk8:$kotlin_version")
    implementation("io.ktor:ktor-server-netty:$ktor_version")
    implementation("ch.qos.logback:logback-classic:$logback_version")
    implementation("com.apurebase:kgraphql:$KGraphQLVersion")
    implementation("com.apurebase:kgraphql-ktor:$KGraphQLVersion")
    testImplementation("io.ktor:ktor-server-tests:$ktor_version")
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