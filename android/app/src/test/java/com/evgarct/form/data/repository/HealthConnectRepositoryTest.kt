package com.evgarct.form.data.repository

import androidx.health.connect.client.records.ExerciseSessionRecord
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant

class HealthConnectRepositoryTest {

    @Test
    fun testWorkoutKindFromExerciseType() {
        assertEquals(WorkoutKind.RUNNING, WorkoutKind.fromExerciseType(ExerciseSessionRecord.EXERCISE_TYPE_RUNNING))
        assertEquals(WorkoutKind.RUNNING, WorkoutKind.fromExerciseType(ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL))
        assertEquals(WorkoutKind.WALKING, WorkoutKind.fromExerciseType(ExerciseSessionRecord.EXERCISE_TYPE_WALKING))
        assertEquals(WorkoutKind.CYCLING, WorkoutKind.fromExerciseType(ExerciseSessionRecord.EXERCISE_TYPE_BIKING))
        assertEquals(WorkoutKind.CYCLING, WorkoutKind.fromExerciseType(ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY))
        assertEquals(WorkoutKind.SWIMMING, WorkoutKind.fromExerciseType(ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL))
        assertEquals(WorkoutKind.SWIMMING, WorkoutKind.fromExerciseType(ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_OPEN_WATER))
        assertEquals(WorkoutKind.HIKING, WorkoutKind.fromExerciseType(ExerciseSessionRecord.EXERCISE_TYPE_HIKING))
        assertEquals(WorkoutKind.YOGA, WorkoutKind.fromExerciseType(ExerciseSessionRecord.EXERCISE_TYPE_YOGA))
        assertEquals(WorkoutKind.STRENGTH, WorkoutKind.fromExerciseType(ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING))
        assertEquals(WorkoutKind.STRENGTH, WorkoutKind.fromExerciseType(ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING))
        assertEquals(WorkoutKind.STRENGTH, WorkoutKind.fromExerciseType(ExerciseSessionRecord.EXERCISE_TYPE_CALISTHENICS))
        assertEquals(WorkoutKind.HIIT, WorkoutKind.fromExerciseType(ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING))
        assertEquals(WorkoutKind.CORE, WorkoutKind.fromExerciseType(ExerciseSessionRecord.EXERCISE_TYPE_PILATES))
        assertEquals(WorkoutKind.ELLIPTICAL, WorkoutKind.fromExerciseType(ExerciseSessionRecord.EXERCISE_TYPE_ELLIPTICAL))
        assertEquals(WorkoutKind.ROWING, WorkoutKind.fromExerciseType(ExerciseSessionRecord.EXERCISE_TYPE_ROWING_MACHINE))
        assertEquals(WorkoutKind.OTHER, WorkoutKind.fromExerciseType(ExerciseSessionRecord.EXERCISE_TYPE_OTHER_WORKOUT))
        assertEquals(WorkoutKind.OTHER, WorkoutKind.fromExerciseType(99999))
    }

    @Test
    fun testWorkoutSummaryCreation() {
        val now = Instant.now()
        val summary = WorkoutSummary(
            id = "test-workout-1",
            kind = WorkoutKind.RUNNING,
            title = "Morning Run",
            durationSeconds = 1920L, // 32 mins
            totalEnergyBurnedKcal = 340.0,
            startTime = now
        )

        assertEquals("test-workout-1", summary.id)
        assertEquals(WorkoutKind.RUNNING, summary.kind)
        assertEquals("Morning Run", summary.title)
        assertEquals(1920L, summary.durationSeconds)
        assertEquals(340.0, summary.totalEnergyBurnedKcal ?: 0.0, 0.01)
        assertEquals(now, summary.startTime)
    }

    @Test
    fun testActivityDataStateValueWithWorkouts() {
        val workout = WorkoutSummary(
            id = "w1",
            kind = WorkoutKind.WALKING,
            title = null,
            durationSeconds = 2400L,
            totalEnergyBurnedKcal = 180.0,
            startTime = Instant.now()
        )
        val state = ActivityDataState.Value(
            steps = 8420L,
            goal = 10000,
            distanceMeters = 6200.0,
            weeklyAverage = 9100L,
            weeklySteps = emptyList(),
            workouts = listOf(workout)
        )

        assertEquals(8420L, state.steps)
        assertEquals(10000, state.goal)
        assertEquals(1, state.workouts.size)
        assertEquals(WorkoutKind.WALKING, state.workouts.first().kind)
    }
}
