package com.evgarct.form.ui.workout

import android.graphics.Bitmap
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.evgarct.form.FormApp
import com.evgarct.form.core.theme.FormTheme
import com.evgarct.form.data.models.DraftExercise
import com.evgarct.form.data.models.DraftSet
import com.evgarct.form.data.models.MuscleVolumeWeek
import com.evgarct.form.data.models.RecentExercise
import com.evgarct.form.data.models.RecentWorkoutSession
import com.evgarct.form.data.models.SessionSummary
import com.evgarct.form.data.models.TemplateExerciseDto
import com.evgarct.form.data.models.WorkoutDraft
import com.evgarct.form.data.models.WorkoutFeedback
import com.evgarct.form.data.models.WorkoutTemplate
import com.evgarct.form.data.models.WorkoutSetDto
import com.evgarct.form.ui.shell.RootScreen
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Visual QA without a login: seeds the on-disk workout draft with fixture data (nothing real),
 * renders the Training tab and writes PNGs to the app's external files dir for review:
 *   adb pull /sdcard/Android/data/com.evgarct.form/files/workout-qa .
 * Not an assertion test — it fails only if the screen cannot be composed.
 */
@RunWith(AndroidJUnit4::class)
class WorkoutScreenshotTest {

    @get:Rule
    val rule = createComposeRule()

    private val store get() = FormApp.instance.workoutRepository.draftStore

    private fun save(name: String) {
        rule.waitForIdle()
        val dir = File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null), "workout-qa")
        dir.mkdirs()
        File(dir, "$name.png").outputStream().use {
            rule.onRoot().captureToImage().asAndroidBitmap().compress(Bitmap.CompressFormat.PNG, 100, it)
        }
    }

    private fun fixtureDraft() = WorkoutDraft(
        id = "qa-fixture",
        startedAtMillis = System.currentTimeMillis() - 23 * 60_000,
        timezone = "Europe/Prague",
        exercises = listOf(
            DraftExercise(
                exerciseId = "ex-squat", name = "Barbell Back Squat", primaryMuscles = listOf("quads"),
                lastTopWeightKg = 100.0, bestE1rmKg = 128.5,
                sets = listOf(
                    DraftSet("s1", reps = 10, weightKg = 40.0, setType = "warmup", done = true),
                    DraftSet("s2", reps = 5, weightKg = 100.0, rir = 2, done = true),
                    DraftSet("s3", reps = 5, weightKg = 100.0),
                    DraftSet("s4")
                )
            ),
            DraftExercise(
                exerciseId = "ex-row", name = "Seated Cable Row", primaryMuscles = listOf("lats"),
                lastTopWeightKg = 62.5,
                sets = listOf(DraftSet("r1", reps = 8, weightKg = 62.5, rir = 1, done = true, groupId = "g1"))
            )
        )
    )

    @Test
    fun activeWorkout() {
        store.saveDraft(fixtureDraft())
        rule.setContent { FormTheme { WorkoutScreen() } }
        save("active")

        // Completing a working set only marks it done (there is no rest timer).
        rule.onAllNodesWithContentDescription("Set done")[2].performClick()
        save("active-done")
    }

    @Test
    fun idle() {
        store.saveDraft(null)
        rule.setContent { FormTheme { WorkoutScreen() } }
        save("idle")
    }

    @Test
    fun navigationBar() {
        store.saveDraft(null)
        rule.setContent { FormTheme { RootScreen(onSignOut = {}) } }
        rule.onNodeWithText("Train").performClick()
        save("nav-workout-tab")
    }

    @Test
    fun volumeAndHistory() {
        val volume = listOf(
            MuscleVolumeWeek("2026-10-05", mapOf("chest" to 9.5, "triceps" to 4.5, "shoulders" to 5.0, "lats" to 12.0, "quads" to 3.0), 34.0),
            MuscleVolumeWeek("2026-09-28", mapOf("chest" to 12.0, "triceps" to 6.0, "lats" to 8.0, "hamstrings" to 6.0), 32.0)
        )
        val session = RecentWorkoutSession(
            eventId = "e1", occurredAt = "2026-10-03T16:00:00Z", timezone = "Europe/Prague",
            muscleGroups = listOf("chest", "triceps"),
            exercises = listOf(
                RecentExercise("a", "Bench Press", listOf(
                    WorkoutSetDto(setIndex = 1, reps = 10, weightKg = 40.0, setType = "warmup"),
                    WorkoutSetDto(setIndex = 2, reps = 8, weightKg = 80.0, rir = 2),
                    WorkoutSetDto(setIndex = 3, reps = 7, weightKg = 82.5, rir = 1)
                ))
            ),
            summary = SessionSummary(setCount = 3, exerciseCount = 1, tonnageKg = 1216.5)
        )
        rule.setContent {
            FormTheme {
                Column(
                    modifier = Modifier.padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(28.dp)
                ) {
                    VolumeSection(volume)
                    RecentSessionRow(session = session, onDelete = {})
                }
            }
        }
        save("volume")
    }

    @Test
    fun templatesList() {
        val templates = listOf(
            WorkoutTemplate("t1", "Push A", exercises = List(5) { TemplateExerciseDto("e$it") }),
            WorkoutTemplate("t2", "Pull B", exercises = List(6) { TemplateExerciseDto("f$it") }),
            WorkoutTemplate("t3", "Legs", exercises = List(4) { TemplateExerciseDto("g$it") })
        )
        rule.setContent {
            FormTheme {
                Column(modifier = Modifier.padding(24.dp)) {
                    TemplatesSection(templates = templates, startingId = "t2", startFailed = false, onStart = {})
                }
            }
        }
        save("templates")
    }

    @Test
    fun activeFromTemplate() {
        store.saveDraft(
            WorkoutDraft(
                id = "qa-template", startedAtMillis = System.currentTimeMillis() - 4 * 60_000, timezone = "Europe/Prague",
                exercises = listOf(
                    DraftExercise(
                        exerciseId = "ex-bench", name = "Barbell Bench Press", primaryMuscles = listOf("chest"),
                        lastTopWeightKg = 80.0, bestE1rmKg = 107.0, lastReps = listOf(9, 8), repMin = 6, repMax = 10, targetRir = 2,
                        suggestedWeightKg = 82.5,
                        sets = List(3) { DraftSet("b$it", weightKg = 82.5, groupId = "g1") }
                    ),
                    DraftExercise(
                        exerciseId = "ex-fly", name = "Cable Fly", primaryMuscles = listOf("chest"),
                        repMin = 12, repMax = 12,
                        sets = List(2) { DraftSet("f$it", groupId = "g1") }
                    )
                )
            )
        )
        rule.setContent { FormTheme { WorkoutScreen() } }
        save("active-template")
    }

    @Test
    fun finishFeedbackForm() {
        rule.setContent {
            FormTheme {
                Column(modifier = Modifier.padding(top = 24.dp)) {
                    FinishFeedbackForm(
                        onConfirm = {},
                        initial = WorkoutFeedback(exertion = 4, mood = "good", note = "Плечо немного тянуло")
                    )
                }
            }
        }
        save("feedback")
    }
}
