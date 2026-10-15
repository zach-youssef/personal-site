package com.zyoussef.Respositories

import java.io.File

// Serves the images found in a directory that is published at baseUrl
class RaytracerImageRepository(private val directory: File, private val baseUrl: String) : IRaytracerRepository {
    override fun getImageUrls(): List<String> {
        // list() returns null if the directory is missing, e.g. before assets are deployed
        return directory.list()?.sorted()?.map { "$baseUrl/$it" } ?: emptyList()
    }
}
