package com.evgarct.form.data.repository

import com.evgarct.form.core.network.ApiClient
import com.evgarct.form.data.models.BodyMeasurements
import com.evgarct.form.data.models.TimelineEvent
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

class TimelineRepository(private val apiClient: ApiClient) {

    suspend fun getEvents(): Result<List<TimelineEvent>> = runCatching {
        val jsonStr = apiClient.get("api/events")
        val events = apiClient.json.decodeFromString(ListSerializer(TimelineEvent.serializer()), jsonStr)
        // Sort descending by occurredAt
        events.sortedByDescending { it.parsedDate }
    }

    suspend fun createMeasurements(
        occurredAt: Date,
        timezone: TimeZone,
        values: BodyMeasurements
    ): Result<TimelineEvent> = runCatching {
        val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }

        val eventId = UUID.randomUUID().toString().lowercase()
        val valuesElement = apiClient.json.encodeToJsonElement(BodyMeasurements.serializer(), values)

        val body = buildJsonObject {
            put("id", eventId)
            put("type", "measurements")
            put("occurredAt", isoFormat.format(occurredAt))
            put("timezone", timezone.id)
            put("values", valuesElement)
        }.toString()

        val responseStr = apiClient.postJson("api/events", body)
        apiClient.json.decodeFromString(TimelineEvent.serializer(), responseStr)
    }

    suspend fun deleteEvent(eventId: String): Result<Unit> = runCatching {
        apiClient.delete("api/events/$eventId")
    }
}
