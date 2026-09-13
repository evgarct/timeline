package com.evgarct.form.data.models

import kotlinx.serialization.Serializable

@Serializable
data class WorkoutSnapshot(
    val kind: String,
    val durationSeconds: Long,
    val caloriesKcal: Double? = null
)

/** A single day's synced activity snapshot, as stored server-side in `daily_activity`. */
@Serializable
data class DailyActivitySnapshot(
    val activityDate: String,
    val timezone: String,
    val steps: Long,
    val goalSteps: Int,
    val distanceMeters: Long? = null,
    val weeklyAverage: Long? = null,
    val workoutCount: Int = 0,
    val workoutSummary: List<WorkoutSnapshot>? = null
)
