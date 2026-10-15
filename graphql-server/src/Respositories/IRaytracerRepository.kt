package com.zyoussef.Respositories

interface IRaytracerRepository {
    // Returns the urls of the raytracer's sample output images
    fun getImageUrls(): List<String>
}
