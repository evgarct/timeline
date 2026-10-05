package com.evgarct.form.ui.timeline

import android.graphics.Bitmap
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.evgarct.form.core.theme.FormTheme
import com.evgarct.form.data.models.TimelineEvent
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/** Fixture-only visual QA for Timeline rows (same pull recipe as WorkoutScreenshotTest, dir `timeline-qa`). */
@RunWith(AndroidJUnit4::class)
class TimelineScreenshotTest {

    @get:Rule
    val rule = createComposeRule()

    @Test
    fun workoutRow() {
        rule.setContent {
            FormTheme {
                Column(modifier = Modifier.background(Color(0xFF13110E)).padding(horizontal = 18.dp, vertical = 16.dp)) {
                    TimelineWorkoutItem(
                        TimelineEvent.Workout(
                            id = "w1", occurredAt = "2026-10-03T16:00:00.000Z", timezone = "Europe/Prague",
                            note = null, completed = true, muscleGroups = listOf("chest", "triceps", "shoulders")
                        )
                    )
                    TimelineWorkoutItem(
                        TimelineEvent.Workout(
                            id = "w2", occurredAt = "2026-09-30T16:00:00.000Z", timezone = "Europe/Prague",
                            note = null, completed = true, muscleGroups = listOf("lats", "biceps")
                        )
                    )
                }
            }
        }
        rule.waitForIdle()
        val dir = File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null), "timeline-qa")
        dir.mkdirs()
        File(dir, "workout-row.png").outputStream().use {
            rule.onRoot().captureToImage().asAndroidBitmap().compress(Bitmap.CompressFormat.PNG, 100, it)
        }
    }
}
