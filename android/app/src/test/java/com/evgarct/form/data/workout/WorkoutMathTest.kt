package com.evgarct.form.data.workout

import com.evgarct.form.data.models.DraftExercise
import com.evgarct.form.data.models.DraftSet
import com.evgarct.form.data.models.LastSetDto
import com.evgarct.form.data.models.LoadSuggestion
import com.evgarct.form.data.models.PlannedExerciseDto
import com.evgarct.form.data.models.ProgressionRule
import com.evgarct.form.data.models.TemplatePlan
import com.evgarct.form.data.models.WorkoutDraft
import com.evgarct.form.data.models.WorkoutFeedback
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
    fun requestKeepsEverythingMarkedDoneEvenWithoutRepsAndNumbersItAcrossExercises() {
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
        assertEquals(listOf(1, 2, 3), request!!.sets.map { it.setIndex })
        assertEquals(listOf("squat", "squat", "row"), request.sets.map { it.exerciseId })
        // The set marked done without typed reps is still recorded (reps unknown, not dropped).
        assertNull(request.sets[1].reps)
        assertEquals(100.0, request.sets[1].weightKg!!, 0.001)
        assertEquals(2, request.sets[2].rir)
        assertEquals("ss1", request.sets[2].groupId)
        assertEquals(listOf("quads", "lats"), request.muscleGroups)
        assertEquals("android-workout:d1", request.idempotencyKey)
    }

    @Test
    fun draftWithNothingMarkedDoneProducesNoRequestAndWarmupsAreExcludedFromTonnage() {
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

    @Test
    fun planBecomesADraftWithPrescribedSetsSuggestedWeightAndSupersets() {
        var counter = 0
        val plan = TemplatePlan(
            id = "t1", name = "Push A",
            exercises = listOf(
                PlannedExerciseDto(
                    exerciseId = "bench", name = "Bench Press", primaryMuscles = listOf("chest"), sets = 3,
                    repMin = 6, repMax = 10, targetRir = 2, groupId = "g1",
                    progression = ProgressionRule("double", 2.5),
                    lastSets = listOf(LastSetDto(10, 80.0), LastSetDto(9, 80.0)),
                    suggestion = LoadSuggestion(82.5, "increase")
                ),
                PlannedExerciseDto(exerciseId = "fly", name = "Fly", sets = 0)
            )
        )

        val draft = plan.toDraft("d9", 1_000L, "Europe/Prague") { "id-${counter++}" }

        assertEquals(2, draft.exercises.size)
        val bench = draft.exercises[0]
        assertEquals(3, bench.sets.size)
        assertEquals(listOf("id-0", "id-1", "id-2"), bench.sets.map { it.id })
        assertEquals(82.5, bench.sets[0].weightKg!!, 0.001)
        assertEquals("g1", bench.sets[2].groupId)
        assertEquals(80.0, bench.lastTopWeightKg!!, 0.001)
        assertEquals(1, draft.exercises[1].sets.size)
        assertNull(draft.exercises[1].sets[0].weightKg)
    }

    @Test
    fun savingATemplateKeepsPrescriptionAndDerivesRepsForAdHocExercises() {
        val request = draft(
            DraftExercise(
                "bench", "Bench", repMin = 6, repMax = 10, targetRir = 2,
                progression = ProgressionRule("double", 2.5),
                sets = listOf(
                    DraftSet("w", reps = 12, weightKg = 40.0, setType = "warmup", done = true),
                    DraftSet("a", reps = 8, weightKg = 80.0, done = true, groupId = "g1"),
                    DraftSet("b", reps = 8, weightKg = 80.0, done = true, groupId = "g1")
                )
            ),
            DraftExercise(
                "row", "Row",
                sets = listOf(
                    DraftSet("c", reps = 12, weightKg = 50.0, done = true),
                    DraftSet("d", reps = 9, weightKg = 50.0, done = true),
                    DraftSet("e")
                )
            )
        ).toTemplateRequest("  Push A  ")!!

        assertEquals("Push A", request.name)
        val bench = request.exercises[0]
        assertEquals(2, bench.sets)
        assertEquals(6, bench.repMin)
        assertEquals(10, bench.repMax)
        assertEquals(2, bench.targetRir)
        assertEquals("g1", bench.groupId)
        assertEquals(2.5, bench.progression!!.incrementKg, 0.001)
        val row = request.exercises[1]
        assertEquals(2, row.sets)
        assertEquals(9, row.repMin)
        assertEquals(12, row.repMax)
    }

    @Test
    fun savingATemplateNeedsANameAndAtLeastOneExercise() {
        assertNull(draft().toTemplateRequest("Push"))
        assertNull(draft(DraftExercise("x", "X")).toTemplateRequest("   "))
    }

    @Test
    fun repsHintPrefersLastSessionsSetThenTheBottomOfTheRange() {
        val exercise = DraftExercise("bench", "Bench", repMin = 6, repMax = 10, lastReps = listOf(9, 8))
        assertEquals(9, repsHint(exercise, 0))
        assertEquals(8, repsHint(exercise, 1))
        assertEquals(6, repsHint(exercise, 2))
        assertNull(repsHint(DraftExercise("x", "X"), 0))
    }

    @Test
    fun planKeepsLastSessionsRepsAndSavedTemplateKeepsTheWorkingWeight() {
        val plan = TemplatePlan(
            id = "t", name = "Push",
            exercises = listOf(
                PlannedExerciseDto(
                    exerciseId = "bench", name = "Bench", sets = 2, weightKg = 80.0,
                    lastSets = listOf(LastSetDto(9, 77.5), LastSetDto(8, 77.5)),
                    suggestion = LoadSuggestion(80.0, "planned")
                )
            )
        )
        var n = 0
        val draft = plan.toDraft("d", 0L, "UTC") { "s${n++}" }
        assertEquals(listOf(9, 8), draft.exercises[0].lastReps)
        assertEquals(80.0, draft.exercises[0].sets[0].weightKg!!, 0.001)

        val withDone = draft.copy(exercises = draft.exercises.map { exercise ->
            exercise.copy(sets = exercise.sets.map { it.copy(reps = 8, done = true) })
        })
        assertEquals(80.0, withDone.toTemplateRequest("Push")!!.exercises[0].weightKg!!, 0.001)
    }

    @Test
    fun feedbackGoesIntoTheRequestAndIsOptional() {
        val done = draft(DraftExercise("squat", "Squat", listOf("quads"), listOf(DraftSet("a", reps = 5, weightKg = 100.0, done = true))))

        val plain = done.toRequest()!!
        assertNull(plain.note)
        assertNull(plain.exertion)
        assertNull(plain.mood)

        val withFeedback = done.toRequest(WorkoutFeedback(exertion = 9, mood = "good", note = "  колено немного ныло  "))!!
        assertEquals(5, withFeedback.exertion) // clamped to the 1..5 scale
        assertEquals("good", withFeedback.mood)
        assertEquals("колено немного ныло", withFeedback.note)

        assertNull(done.toRequest(WorkoutFeedback(note = "   "))!!.note)
    }
}
