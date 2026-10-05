package com.evgarct.form.ui.workout

import android.graphics.Bitmap
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
import com.evgarct.form.data.models.WorkoutDraft
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

        // Completing a working set starts the rest countdown.
        rule.onAllNodesWithContentDescription("Set done")[2].performClick()
        save("active-rest")
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
}
