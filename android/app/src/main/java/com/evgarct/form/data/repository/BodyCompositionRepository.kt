package com.evgarct.form.data.repository

import com.evgarct.form.core.network.ApiClient
import com.evgarct.form.data.models.BodyTest
import com.evgarct.form.data.models.BodyTestsResponse
import java.io.File
import java.util.TimeZone

/** InBody tests with the diet, steps, training and photos between them (the backend does the aggregation). */
class BodyCompositionRepository(private val apiClient: ApiClient, private val cacheDir: File) {

    /**
     * Downloads the original sheet of a test into the cache for the viewer (the media route needs the session cookie, so
     * a browser or viewer cannot fetch it by URL). The cache is cleared by the system; nothing is kept in app storage.
     */
    suspend fun downloadOriginal(assetId: String, fileName: String?): Result<File> = runCatching {
        val bytes = apiClient.getBytes("api/media/$assetId")
        val directory = File(cacheDir, "inbody").apply { mkdirs() }
        val safeName = (fileName ?: "inbody").replace(Regex("[^A-Za-z0-9._-]"), "_").take(80)
        File(directory, "$assetId-$safeName").apply { writeBytes(bytes) }
    }

    /** Only the context around each test is read here: the readings themselves come with the timeline events. */
    suspend fun getTests(timezone: TimeZone = TimeZone.getDefault()): Result<List<BodyTest>> = runCatching {
        val body = apiClient.get("api/body/inbody", mapOf("timezone" to timezone.id, "metrics" to "weight"))
        apiClient.json.decodeFromString(BodyTestsResponse.serializer(), body).tests
    }
}
