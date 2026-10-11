package com.evgarct.form.ui.timeline

import android.graphics.Bitmap
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.evgarct.form.core.theme.FormTheme
import com.evgarct.form.data.models.INBODY_SEGMENTS
import com.evgarct.form.data.models.InBodyMetric
import com.evgarct.form.data.models.InBodySource
import com.evgarct.form.data.models.TimelineEvent
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Fixture-only visual QA for the InBody card and sheet (fabricated numbers, never a real report).
 * Pull the PNGs from `files/inbody-qa` as described in docs/ANDROID_DEBUGGING.md.
 */
@RunWith(AndroidJUnit4::class)
class InBodyScreenshotTest {

    @get:Rule
    val rule = createComposeRule()

    private fun metric(key: String, label: String, value: Double, unit: String?, category: String, min: Double? = null, max: Double? = null, evaluation: String? = null) =
        InBodyMetric(key = key, label = label, value = value, unit = unit, category = category, referenceMin = min, referenceMax = max, evaluation = evaluation)

    private fun sheet(id: String, occurredAt: String, later: Boolean): TimelineEvent.InBody {
        fun v(start: Double, end: Double) = if (later) end else start
        val metrics = mutableListOf(
            metric("inbody_score", "InBody Score", v(78.0, 82.0), "points", "other"),
            metric("total_body_water", "Total Body Water", v(46.8, 48.2), "L", "composition", 40.1, 49.0),
            metric("protein", "Protein", v(12.6, 13.1), "kg", "composition", 10.8, 13.2),
            metric("minerals", "Minerals", v(4.2, 4.4), "kg", "composition", 3.7, 4.5),
            metric("body_fat_mass", "Body Fat Mass", v(11.4, 10.2), "kg", "composition", 8.4, 16.9),
            metric("weight", "Weight", v(75.0, 76.1), "kg", "composition", 60.2, 81.4),
            metric("skeletal_muscle_mass", "Skeletal Muscle Mass", v(36.4, 38.2), "kg", "composition", 33.1, 40.5),
            metric("bmi", "BMI", v(22.6, 22.9), "kg/m²", "obesity", 18.5, 25.0, "normal"),
            metric("percent_body_fat", "Percent Body Fat", v(15.2, 13.4), "%", "obesity", 10.0, 20.0, "normal"),
            metric("waist_hip_ratio", "Waist-Hip Ratio", v(0.84, 0.82), null, "obesity", 0.8, 0.9),
            metric("visceral_fat_level", "Visceral Fat Level", v(4.0, 3.0), null, "obesity", 1.0, 9.0),
            metric("target_weight", "Target Weight", 75.5, "kg", "control"),
            metric("fat_free_mass", "Fat Free Mass", v(63.6, 65.9), "kg", "research", 52.7, 65.2),
            metric("basal_metabolic_rate", "Basal Metabolic Rate", v(1760.0, 1810.0), "kcal", "research", 1560.0, 1830.0)
        )
        INBODY_SEGMENTS.forEach { segment ->
            metrics += InBodyMetric("lean_mass_kg", "Segmental Lean Mass", v(3.5, 3.7) + if (segment == "trunk") 25.0 else 0.0, "kg", "segmental_lean", segment = segment)
            metrics += InBodyMetric("lean_mass_pct", "Segmental Lean Evaluation", v(105.0, 109.0), "%", "segmental_lean", segment = segment, evaluation = "normal")
            metrics += InBodyMetric("fat_mass_kg", "Segmental Fat Mass", v(0.5, 0.4), "kg", "segmental_fat", segment = segment)
            metrics += InBodyMetric("fat_mass_pct", "Segmental Fat Evaluation", v(88.0, 80.0), "%", "segmental_fat", segment = segment, evaluation = "under")
            listOf(20.0, 100.0).forEach { frequency ->
                metrics += InBodyMetric("impedance_ohm", "Impedance", (if (frequency == 20.0) 300.0 else 260.0) + segment.length, "Ω", "impedance", segment = segment, frequencyKhz = frequency)
            }
        }
        return TimelineEvent.InBody(
            id = id, occurredAt = occurredAt, timezone = "Europe/Prague", note = null,
            metrics = metrics,
            source = InBodySource(assetId = "5b7f2a40-1c8e-4d6a-9f3b-2e1d0c9b8a77", mimeType = "image/jpeg", fileName = "sheet.jpg"),
            reviewed = later, device = "InBody270"
        )
    }

    private val start = sheet("i1", "2026-03-01T09:00:00.000Z", later = false)
    private val latest = sheet("i2", "2026-06-20T14:16:00.000Z", later = true)

    private fun save(name: String) {
        val dir = File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null), "inbody-qa")
        dir.mkdirs()
        File(dir, "$name.png").outputStream().use {
            rule.onRoot().captureToImage().asAndroidBitmap().compress(Bitmap.CompressFormat.PNG, 100, it)
        }
    }

    @Test
    fun timelineCard() {
        rule.setContent {
            FormTheme {
                Column(modifier = Modifier.background(Color(0xFF13110E)).padding(horizontal = 18.dp, vertical = 16.dp)) {
                    TimelineInBodyItem(event = latest, previous = start)
                    TimelineInBodyItem(event = start)
                }
            }
        }
        rule.waitForIdle()
        save("card")
    }

    @Test
    fun detailSheet() {
        rule.setContent {
            FormTheme { InBodyDetailSheet(event = latest, tests = listOf(start, latest), onDismiss = {}) }
        }
        rule.waitForIdle()
        save("sheet-1")
        repeat(3) { index ->
            // The first scrollable is the sheet itself; the trend chips scroll sideways.
            rule.onAllNodes(hasScrollAction())[0].performTouchInput { swipeUp() }
            rule.waitForIdle()
            save("sheet-${index + 2}")
        }
    }
}
