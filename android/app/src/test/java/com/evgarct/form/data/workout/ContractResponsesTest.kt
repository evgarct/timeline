package com.evgarct.form.data.workout

import com.evgarct.form.data.models.Exercise
import com.evgarct.form.data.models.ExerciseHistory
import com.evgarct.form.data.models.ExercisePage
import com.evgarct.form.data.models.MuscleVolumeResponse
import com.evgarct.form.data.models.RecentWorkoutsResponse
import com.evgarct.form.data.models.TemplatePlan
import com.evgarct.form.data.models.WorkoutSessionResult
import com.evgarct.form.data.models.WorkoutTemplate
import com.evgarct.form.data.models.WorkoutTemplatesResponse
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Decodes real responses of the Next.js API (recorded from a live local server in demo mode, see
 * `src/test/resources/contract/`) with the exact Json settings of `ApiClient`, so a schema drift on
 * either side fails here instead of in the gym.
 */
class ContractResponsesTest {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
        coerceInputValues = true
    }

    private fun fixture(name: String): String =
        requireNotNull(javaClass.getResourceAsStream("/contract/$name")) { "missing fixture $name" }
            .bufferedReader().use { it.readText() }

    @Test
    fun exerciseAndSearchPage() {
        val exercise = json.decodeFromString(Exercise.serializer(), fixture("exercise.json"))
        assertEquals("Contract Squat", exercise.name)
        assertEquals(listOf("quads"), exercise.primaryMuscles)
        assertEquals(listOf("glutes"), exercise.secondaryMuscles)
        assertEquals("squat", exercise.movementPattern)

        val page = json.decodeFromString(ExercisePage.serializer(), fixture("exercises-page.json"))
        assertTrue(page.items.any { it.id == exercise.id })
    }

    @Test
    fun templateListAndPlanBeforeAnyHistory() {
        val template = json.decodeFromString(WorkoutTemplate.serializer(), fixture("template.json"))
        val entry = template.exercises.single()
        assertEquals(100.0, entry.weightKg!!, 0.001)
        assertEquals(6, entry.repMin)
        assertEquals(8, entry.repMax)
        assertEquals(2, entry.targetRir)
        assertEquals(120, entry.restSeconds)
        assertEquals(2.5, entry.progression!!.incrementKg, 0.001)

        val list = json.decodeFromString(WorkoutTemplatesResponse.serializer(), fixture("templates.json"))
        assertTrue(list.items.any { it.id == template.id })

        val plan = json.decodeFromString(TemplatePlan.serializer(), fixture("plan-first.json"))
        val planned = plan.exercises.single()
        assertEquals("Contract Squat", planned.name)
        assertEquals("planned", planned.suggestion.reason)
        assertEquals(100.0, planned.suggestion.weightKg!!, 0.001)
        assertTrue(planned.lastSets.isEmpty())
    }

    @Test
    fun uploadedSessionIncludingTheSetMarkedDoneWithoutReps() {
        val result = json.decodeFromString(WorkoutSessionResult.serializer(), fixture("session-result.json"))
        assertEquals(2, result.summary.setCount)
        assertEquals(1, result.summary.exerciseCount)
        assertEquals(2, result.sets.size)
        assertEquals(8, result.sets[0].reps)
        assertEquals(2, result.sets[0].rir)
        assertNull(result.sets[1].reps)
        assertEquals(100.0, result.sets[1].weightKg!!, 0.001)

        val recent = json.decodeFromString(RecentWorkoutsResponse.serializer(), fixture("recent.json")).sessions
        assertEquals(result.eventId, recent[0].eventId)
        assertEquals("Contract Squat", recent[0].exercises.single().name)
        assertEquals(2, recent[0].exercises.single().sets.size)
    }

    @Test
    fun volumeHistoryAndTheNextPlanAfterTheFirstSession() {
        val weeks = json.decodeFromString(MuscleVolumeResponse.serializer(), fixture("volume.json")).weeks
        assertEquals(2, weeks.size)
        assertEquals(2.0, weeks[0].sets["quads"]!!, 0.001)
        assertEquals(1.0, weeks[0].sets["glutes"]!!, 0.001)

        val history = json.decodeFromString(ExerciseHistory.serializer(), fixture("history.json"))
        assertEquals(1, history.windowSessions)
        assertNotNull(history.bestE1rmKg)

        val plan = json.decodeFromString(TemplatePlan.serializer(), fixture("plan-after.json"))
        val planned = plan.exercises.single()
        assertEquals(1, planned.lastSets.count { it.reps == 8 })
        assertEquals("increase", planned.suggestion.reason)
        assertEquals(102.5, planned.suggestion.weightKg!!, 0.001)
    }
}
