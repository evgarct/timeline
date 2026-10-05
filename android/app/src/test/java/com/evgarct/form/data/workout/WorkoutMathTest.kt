package com.evgarct.form.data.workout

import com.evgarct.form.data.models.DraftExercise
import com.evgarct.form.data.models.DraftSet
import com.evgarct.form.data.models.WorkoutDraft
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class WorkoutMathTest {

    private fun draft(vararg exercises: DraftExercise) = WorkoutDraft(
        id = "d1", startedAtMillis = 1_760_000_000_000, timezone = "Europe/Prague", exercises = exercises.toList()
    )

    @Test
    fun e1rmFollowsEpleyAndIgnoresOutOfRangeReps() {
        assertEquals(76.0, estimateOneRepMaxKg(60.0, 8)!!, 0.001)
        assertNull(estimateOneRepMaxKg(60.0, 13))
        assertNull(estimateOneRepMaxKg(0.0, 5))
    }

    @Test
    fun requestKeepsOnlyDoneSetsWithRepsAndNumbersThemAcrossExercises() {
        val request = draft(
            DraftExercise(
                "squat", "Squat", listOf("quads"),
                listOf(
                    DraftSet("a", reps = 5, weightKg = 100.0, done = true),
                    DraftSet("b", reps = 5, weightKg = 100.0, done = false),
                    DraftSet("c", reps = null, weightKg = 100.0, done = true)
                )
            ),
            DraftExercise(
                "row", "Row", listOf("lats"),
                listOf(DraftSet("d", reps = 8, weightKg = 60.0, rir = 2, done = true, groupId = "ss1"))
            )
        ).toRequest()

        assertNotNull(request)
        assertEquals(listOf(1, 2), request!!.sets.map { it.setIndex })
        assertEquals(listOf("squat", "row"), request.sets.map { it.exerciseId })
        assertEquals(2, request.sets[1].rir)
        assertEquals("ss1", request.sets[1].groupId)
        assertEquals(listOf("quads", "lats"), request.muscleGroups)
        assertEquals("android-workout:d1", request.idempotencyKey)
    }

    @Test
    fun emptyDraftProducesNoRequestAndWarmupsAreExcludedFromTonnage() {
        assertNull(draft(DraftExercise("squat", "Squat", sets = listOf(DraftSet("a", reps = 5, weightKg = 100.0)))).toRequest())

        val withWarmup = draft(
            DraftExercise(
                "squat", "Squat", listOf("quads"),
                listOf(
                    DraftSet("w", reps = 10, weightKg = 40.0, setType = "warmup", done = true),
                    DraftSet("a", reps = 5, weightKg = 100.0, done = true)
                )
            )
        )
        assertEquals(500.0, withWarmup.tonnageKg(), 0.001)
        assertEquals(2, withWarmup.recordableSetCount())
    }

    @Test
    fun muscleGroupsFallBackToOtherAndCapAtEight() {
        val noMuscles = draft(DraftExercise("x", "X", sets = listOf(DraftSet("a", reps = 5, done = true))))
        assertEquals(listOf("other"), noMuscles.muscleGroups())

        val many = draft(
            DraftExercise("x", "X", (1..10).map { "m$it" }, listOf(DraftSet("a", reps = 5, done = true)))
        )
        assertEquals(8, many.muscleGroups().size)
    }
}
