package com.evgarct.form.data.workout

import com.evgarct.form.data.models.DraftExercise
import com.evgarct.form.data.models.DraftSet
import com.evgarct.form.data.models.ProgressionRule
import com.evgarct.form.data.models.TemplateExerciseDto
import com.evgarct.form.data.models.WorkoutDraft
import com.evgarct.form.data.models.WorkoutTemplateRequest
import kotlinx.serialization.json.Json
import org.junit.Test
import java.io.File

/**
 * Writes the request bodies the app really sends (same Json settings as WorkoutRepository) to
 * `app/build/contract/`, so they can be replayed against a live server (see
 * `ContractResponsesTest` for the other direction). Not an assertion test.
 */
class ContractRequestsTest {

    private val requestJson = Json { ignoreUnknownKeys = true; encodeDefaults = true; explicitNulls = false }

    @Test
    fun writeRequests() {
        val dir = File("build/contract").apply { mkdirs() }

        val draft = WorkoutDraft(
            id = "contract-2", startedAtMillis = System.currentTimeMillis(), timezone = "Europe/Prague",
            exercises = listOf(
                DraftExercise(
                    exerciseId = "__SQUAT__", name = "Squat", primaryMuscles = listOf("quads"),
                    sets = listOf(
                        DraftSet("a", reps = 8, weightKg = 100.0, rir = 2, done = true),
                        // marked done, reps left blank: must still be accepted by the server
                        DraftSet("b", weightKg = 100.0, done = true),
                        DraftSet("c", reps = 5, weightKg = 100.0, done = false)
                    )
                )
            )
        )
        File(dir, "workout-request.json").writeText(
            requestJson.encodeToString(com.evgarct.form.data.models.WorkoutSessionRequest.serializer(), draft.toRequest()!!)
        )

        val template = WorkoutTemplateRequest(
            name = "Contract Push",
            exercises = listOf(
                TemplateExerciseDto(
                    exerciseId = "__SQUAT__", sets = 3, weightKg = 100.0, repMin = 6, repMax = 8, targetRir = 2,
                    restSeconds = 120, progression = ProgressionRule("double", 2.5)
                )
            )
        )
        File(dir, "template-request.json").writeText(
            requestJson.encodeToString(WorkoutTemplateRequest.serializer(), template)
        )
    }
}
