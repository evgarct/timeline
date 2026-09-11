package com.evgarct.form.data.repository

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByDurationRequest
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime

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
        val weeklySteps: List<DailyStepData>
    ) : ActivityDataState()
    object Denied : ActivityDataState()
    object Unavailable : ActivityDataState()
}

class HealthConnectRepository(private val context: Context) {

    val permissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class)
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
            granted.containsAll(permissions)
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

            ActivityDataState.Value(
                steps = steps,
                goal = goal,
                distanceMeters = distance,
                weeklyAverage = avg,
                weeklySteps = weeklySteps
            )
        } catch (e: Exception) {
            ActivityDataState.Unavailable
        }
    }
}
