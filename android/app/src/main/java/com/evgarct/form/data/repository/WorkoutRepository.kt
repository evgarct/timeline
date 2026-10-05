package com.evgarct.form.data.repository

import com.evgarct.form.core.network.ApiClient
import com.evgarct.form.core.network.ApiException
import com.evgarct.form.core.network.SessionExpiredException
import com.evgarct.form.data.models.Exercise
import com.evgarct.form.data.models.ExerciseHistory
import com.evgarct.form.data.models.ExercisePage
import com.evgarct.form.data.models.MuscleVolumeResponse
import com.evgarct.form.data.models.MuscleVolumeWeek
import com.evgarct.form.data.models.RecentWorkoutSession
import com.evgarct.form.data.models.RecentWorkoutsResponse
import com.evgarct.form.data.models.WorkoutSessionRequest
import com.evgarct.form.data.models.WorkoutSessionResult
import com.evgarct.form.data.workout.WorkoutDraftStore
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class WorkoutRepository(
    private val apiClient: ApiClient,
    val draftStore: WorkoutDraftStore
) {
    // The server's zod schemas treat `optional` as "absent", not "null", so requests must omit nulls.
    private val requestJson = Json { ignoreUnknownKeys = true; encodeDefaults = true; explicitNulls = false }

    suspend fun searchExercises(query: String, page: Int = 1): Result<ExercisePage> = runCatching {
        val body = apiClient.get("api/exercises", mapOf("query" to query, "page" to page.toString(), "pageSize" to "30"))
        apiClient.json.decodeFromString(ExercisePage.serializer(), body)
    }

    suspend fun createExercise(name: String, primaryMuscles: List<String>, equipment: String?): Result<Exercise> = runCatching {
        val body = buildJsonObject {
            put("name", name.trim())
            if (primaryMuscles.isNotEmpty()) {
                put("primaryMuscles", buildJsonArray { primaryMuscles.forEach { add(JsonPrimitive(it)) } })
            }
            if (!equipment.isNullOrBlank()) put("equipment", equipment.trim())
        }
        apiClient.json.decodeFromString(Exercise.serializer(), apiClient.postJson("api/exercises", body.toString()))
    }

    suspend fun exerciseHistory(exerciseId: String, limit: Int = 8): Result<ExerciseHistory> = runCatching {
        val body = apiClient.get("api/exercises/$exerciseId/history", mapOf("limit" to limit.toString()))
        apiClient.json.decodeFromString(ExerciseHistory.serializer(), body)
    }

    suspend fun recentSessions(limit: Int = 20): Result<List<RecentWorkoutSession>> = runCatching {
        val body = apiClient.get("api/workouts", mapOf("limit" to limit.toString()))
        apiClient.json.decodeFromString(RecentWorkoutsResponse.serializer(), body).sessions
    }

    suspend fun muscleVolume(weeks: Int = 2, timezoneId: String): Result<List<MuscleVolumeWeek>> = runCatching {
        val body = apiClient.get("api/workouts/volume", mapOf("weeks" to weeks.toString(), "timezone" to timezoneId))
        apiClient.json.decodeFromString(MuscleVolumeResponse.serializer(), body).weeks
    }

    suspend fun submit(request: WorkoutSessionRequest): Result<WorkoutSessionResult> = runCatching {
        val body = requestJson.encodeToString(WorkoutSessionRequest.serializer(), request)
        apiClient.json.decodeFromString(WorkoutSessionResult.serializer(), apiClient.postJson("api/workouts", body))
    }

    suspend fun deleteSession(eventId: String): Result<Unit> = runCatching {
        apiClient.delete("api/workouts/$eventId")
        Unit
    }

    /**
     * Uploads every queued session. A session leaves the queue on success; a retryable failure
     * (network, 5xx, expired login) stops the pass and reports failure so the worker backs off;
     * a rejected one (other 4xx) stays queued but does not block the rest or trigger retries.
     */
    suspend fun flushPending(): FlushResult {
        var rejected = 0
        for (request in draftStore.pending()) {
            val result = submit(request)
            val error = result.exceptionOrNull()
            when {
                error == null -> draftStore.remove(request.idempotencyKey)
                error is ApiException && error.code in 400..499 -> rejected += 1
                else -> return FlushResult.Retry
            }
        }
        return if (rejected > 0) FlushResult.PartiallyRejected(rejected) else FlushResult.Done
    }

    sealed interface FlushResult {
        data object Done : FlushResult
        data object Retry : FlushResult
        data class PartiallyRejected(val count: Int) : FlushResult
    }

    companion object {
        fun isRetryable(error: Throwable): Boolean =
            error is SessionExpiredException || error !is ApiException || error.code >= 500
    }
}
