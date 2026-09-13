package com.evgarct.form.data.repository

import com.evgarct.form.core.network.ApiClient
import com.evgarct.form.data.models.DailyActivitySnapshot
import com.evgarct.form.data.models.WorkoutSnapshot
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.encodeToString
import java.time.LocalDate
import java.util.TimeZone

/**
 * Syncs the Health Connect-derived daily activity snapshot with the server so it
 * survives independent of the phone — the foundation for a full step-counter tracker.
 */
class ActivityRepository(private val apiClient: ApiClient) {

    suspend fun submitDailySnapshot(
        date: LocalDate,
        state: ActivityDataState.Value,
        timezone: TimeZone = TimeZone.getDefault()
    ): Result<Unit> = runCatching {
        val snapshot = DailyActivitySnapshot(
            activityDate = date.toString(),
            timezone = timezone.id,
            steps = state.steps,
            goalSteps = state.goal,
            distanceMeters = state.distanceMeters?.toLong(),
            weeklyAverage = state.weeklyAverage,
            workoutCount = state.workouts.size,
            workoutSummary = state.workouts.take(10).map {
                WorkoutSnapshot(
                    kind = it.kind.name,
                    durationSeconds = it.durationSeconds,
                    caloriesKcal = it.totalEnergyBurnedKcal
                )
            }.ifEmpty { null }
        )
        val body = apiClient.json.encodeToString(DailyActivitySnapshot.serializer(), snapshot)
        apiClient.postJson("api/activity/daily", body)
        Unit
    }

    suspend fun getHistory(fromDate: LocalDate, toDate: LocalDate): Result<List<DailyActivitySnapshot>> = runCatching {
        val jsonStr = apiClient.get(
            "api/activity/daily",
            mapOf("from" to fromDate.toString(), "to" to toDate.toString())
        )
        apiClient.json.decodeFromString(ListSerializer(DailyActivitySnapshot.serializer()), jsonStr)
    }
}
