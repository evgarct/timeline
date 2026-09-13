package com.evgarct.form.data.repository

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.request.AggregateGroupByDurationRequest
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.evgarct.form.R
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime

enum class WorkoutKind(val stringResId: Int) {
    RUNNING(R.string.nutrition_report_workout_running),
    WALKING(R.string.nutrition_report_workout_walking),
    CYCLING(R.string.nutrition_report_workout_cycling),
    SWIMMING(R.string.nutrition_report_workout_swimming),
    HIKING(R.string.nutrition_report_workout_hiking),
    YOGA(R.string.nutrition_report_workout_yoga),
    STRENGTH(R.string.nutrition_report_workout_strength),
    HIIT(R.string.nutrition_report_workout_hiit),
    CORE(R.string.nutrition_report_workout_core),
    ELLIPTICAL(R.string.nutrition_report_workout_elliptical),
    ROWING(R.string.nutrition_report_workout_rowing),
    OTHER(R.string.nutrition_report_workout_other);

    companion object {
        fun fromExerciseType(type: Int): WorkoutKind {
            return when (type) {
                ExerciseSessionRecord.EXERCISE_TYPE_RUNNING,
                ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL -> RUNNING
                ExerciseSessionRecord.EXERCISE_TYPE_WALKING -> WALKING
                ExerciseSessionRecord.EXERCISE_TYPE_BIKING,
                ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY -> CYCLING
                ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL,
                ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_OPEN_WATER -> SWIMMING
                ExerciseSessionRecord.EXERCISE_TYPE_HIKING -> HIKING
                ExerciseSessionRecord.EXERCISE_TYPE_YOGA -> YOGA
                ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING,
                ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING,
                ExerciseSessionRecord.EXERCISE_TYPE_CALISTHENICS -> STRENGTH
                ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING -> HIIT
                ExerciseSessionRecord.EXERCISE_TYPE_PILATES -> CORE
                ExerciseSessionRecord.EXERCISE_TYPE_ELLIPTICAL -> ELLIPTICAL
                ExerciseSessionRecord.EXERCISE_TYPE_ROWING_MACHINE -> ROWING
                else -> OTHER
            }
        }
    }
}

data class WorkoutSummary(
    val id: String,
    val kind: WorkoutKind,
    val title: String?,
    val durationSeconds: Long,
    val totalEnergyBurnedKcal: Double?,
    val startTime: Instant
)

data class DailyStepData(
    val date: LocalDate,
    val steps: Long
)

sealed class ActivityDataState {
    object Loading : ActivityDataState()
    data class Value(
        val steps: Long,
        val goal: Int,
        val distanceMeters: Double?,
        val weeklyAverage: Long,
        val weeklySteps: List<DailyStepData>,
        val workouts: List<WorkoutSummary> = emptyList()
    ) : ActivityDataState()
    object Denied : ActivityDataState()
    object Unavailable : ActivityDataState()
}

class HealthConnectRepository(private val context: Context) {

    val permissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class)
    )

    private val healthConnectClient: HealthConnectClient? by lazy {
        if (HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE) {
            HealthConnectClient.getOrCreate(context)
        } else null
    }

    suspend fun hasPermissions(): Boolean {
        val client = healthConnectClient ?: return false
        return try {
            val granted = client.permissionController.getGrantedPermissions()
            granted.contains(HealthPermission.getReadPermission(StepsRecord::class))
        } catch (e: Exception) {
            false
        }
    }

    suspend fun getActivityData(date: LocalDate, goal: Int): ActivityDataState {
        val client = healthConnectClient ?: return ActivityDataState.Unavailable
        if (!hasPermissions()) {
            return ActivityDataState.Denied
        }

        return try {
            val zoneId = ZoneId.systemDefault()
            val startOfDay = date.atStartOfDay(zoneId).toInstant()
            val endOfDay = date.plusDays(1).atStartOfDay(zoneId).toInstant()

            // Daily steps
            val stepAggregate = client.aggregate(
                AggregateRequest(
                    metrics = setOf(StepsRecord.COUNT_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(startOfDay, endOfDay)
                )
            )
            val steps = stepAggregate[StepsRecord.COUNT_TOTAL] ?: 0L

            // Daily distance
            val distanceAggregate = client.aggregate(
                AggregateRequest(
                    metrics = setOf(DistanceRecord.DISTANCE_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(startOfDay, endOfDay)
                )
            )
            val distance = distanceAggregate[DistanceRecord.DISTANCE_TOTAL]?.inMeters

            // Weekly history (7 days ending with date)
            val weekStart = date.minusDays(6).atStartOfDay(zoneId).toInstant()
            val weeklyResponse = client.aggregateGroupByDuration(
                AggregateGroupByDurationRequest(
                    metrics = setOf(StepsRecord.COUNT_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(weekStart, endOfDay),
                    timeRangeSlicer = Duration.ofDays(1)
                )
            )

            val weeklySteps = (0..6).map { dayOffset ->
                val targetDay = date.minusDays(6L - dayOffset)
                val matchingBucket = weeklyResponse.find { bucket ->
                    val bucketDate = bucket.startTime.atZone(zoneId).toLocalDate()
                    bucketDate == targetDay
                }
                val count = matchingBucket?.result?.get(StepsRecord.COUNT_TOTAL) ?: 0L
                DailyStepData(targetDay, count)
            }

            val totalWeeklySteps = weeklySteps.sumOf { it.steps }
            val avg = if (weeklySteps.isNotEmpty()) totalWeeklySteps / weeklySteps.size else 0L

            // Workouts on selected day
            val workouts = readWorkouts(client, startOfDay, endOfDay)

            ActivityDataState.Value(
                steps = steps,
                goal = goal,
                distanceMeters = distance,
                weeklyAverage = avg,
                weeklySteps = weeklySteps,
                workouts = workouts
            )
        } catch (e: Exception) {
            ActivityDataState.Unavailable
        }
    }

    private suspend fun readWorkouts(
        client: HealthConnectClient,
        startOfDay: Instant,
        endOfDay: Instant
    ): List<WorkoutSummary> {
        return try {
            val granted = client.permissionController.getGrantedPermissions()
            val canReadExercise = granted.contains(HealthPermission.getReadPermission(ExerciseSessionRecord::class))
            if (!canReadExercise) return emptyList()

            val canReadCalories = granted.contains(HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class))

            val sessionResponse = client.readRecords(
                ReadRecordsRequest(
                    recordType = ExerciseSessionRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(startOfDay, endOfDay)
                )
            )

            sessionResponse.records.map { session ->
                val durationSec = Duration.between(session.startTime, session.endTime).seconds
                val calories = if (canReadCalories) {
                    try {
                        val energyAggregate = client.aggregate(
                            AggregateRequest(
                                metrics = setOf(TotalCaloriesBurnedRecord.ENERGY_TOTAL),
                                timeRangeFilter = TimeRangeFilter.between(session.startTime, session.endTime)
                            )
                        )
                        energyAggregate[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories
                    } catch (e: Exception) {
                        null
                    }
                } else null

                WorkoutSummary(
                    id = session.metadata.id,
                    kind = WorkoutKind.fromExerciseType(session.exerciseType),
                    title = session.title?.takeIf { it.isNotBlank() },
                    durationSeconds = maxOf(durationSec, 0L),
                    totalEnergyBurnedKcal = calories,
                    startTime = session.startTime
                )
            }.sortedByDescending { it.startTime }
        } catch (e: Exception) {
            emptyList()
        }
    }
}
