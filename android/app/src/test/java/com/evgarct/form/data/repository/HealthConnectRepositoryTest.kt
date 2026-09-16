package com.evgarct.form.data.repository

import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.MealType as HcMealType
import com.evgarct.form.data.models.FoodEntry
import com.evgarct.form.data.models.FoodProductSnapshot
import com.evgarct.form.data.models.FoodQuantity
import com.evgarct.form.data.models.MealType
import com.evgarct.form.data.models.NutrientValue
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
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

    private fun sampleEntry(nutrients: List<NutrientValue>, mealType: MealType = MealType.LUNCH): FoodEntry =
        FoodEntry(
            id = "entry-1",
            occurredAt = "2026-09-16T12:30:00.000Z",
            timezone = "UTC",
            mealType = mealType,
            quantity = FoodQuantity.Grams(150.0),
            productSnapshot = FoodProductSnapshot(name = "Chicken breast", nutrients = nutrients)
        )

    @Test
    fun testNutritionRecordMapperMapsKnownNutrients() {
        val entry = sampleEntry(
            listOf(
                NutrientValue(key = "energy_kcal", label = "Energy", value = 250.0, unit = "kcal"),
                NutrientValue(key = "protein", label = "Protein", value = 30.0, unit = "g"),
                NutrientValue(key = "fat", label = "Fat", value = 8.0, unit = "g"),
                NutrientValue(key = "carbohydrates", label = "Carbs", value = 0.0, unit = "g"),
                NutrientValue(key = "sodium", label = "Sodium", value = 120.0, unit = "mg"),
                NutrientValue(key = "vitamin_c", label = "Vitamin C", value = 5.0, unit = "mg")
            )
        )

        val record = NutritionRecordMapper.map(entry)

        assertEquals(250.0, record.energy?.inKilocalories ?: 0.0, 0.01)
        assertEquals(30.0, record.protein?.inGrams ?: 0.0, 0.01)
        assertEquals(8.0, record.totalFat?.inGrams ?: 0.0, 0.01)
        assertEquals(0.0, record.totalCarbohydrate?.inGrams ?: -1.0, 0.01)
        assertEquals(120.0, record.sodium?.inMilligrams ?: 0.0, 0.01)
        assertEquals(5.0, record.vitaminC?.inMilligrams ?: 0.0, 0.01)
        assertEquals(HcMealType.MEAL_TYPE_LUNCH, record.mealType)
        assertEquals("Chicken breast", record.name)
        assertEquals("entry-1", record.metadata.clientRecordId)
    }

    @Test
    fun testNutritionRecordMapperSkipsUnrecognizedKeys() {
        val entry = sampleEntry(
            listOf(
                NutrientValue(key = "energy_kcal", label = "Energy", value = 100.0, unit = "kcal"),
                NutrientValue(key = "omega_3", label = "Omega 3", value = 2.0, unit = "g"),
                NutrientValue(key = null, label = "Unknown", value = 1.0, unit = "g")
            )
        )

        val record = NutritionRecordMapper.map(entry)

        assertEquals(100.0, record.energy?.inKilocalories ?: 0.0, 0.01)
        assertNull(record.protein)
        assertNull(record.sodium)
    }

    @Test
    fun testNutritionRecordMapperMapsAllMealTypes() {
        assertEquals(HcMealType.MEAL_TYPE_BREAKFAST, NutritionRecordMapper.map(sampleEntry(emptyList(), MealType.BREAKFAST)).mealType)
        assertEquals(HcMealType.MEAL_TYPE_LUNCH, NutritionRecordMapper.map(sampleEntry(emptyList(), MealType.LUNCH)).mealType)
        assertEquals(HcMealType.MEAL_TYPE_DINNER, NutritionRecordMapper.map(sampleEntry(emptyList(), MealType.DINNER)).mealType)
        assertEquals(HcMealType.MEAL_TYPE_SNACK, NutritionRecordMapper.map(sampleEntry(emptyList(), MealType.SNACK)).mealType)
    }
}
