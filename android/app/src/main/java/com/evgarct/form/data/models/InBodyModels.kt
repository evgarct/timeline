package com.evgarct.form.data.models

import kotlinx.serialization.Serializable
import java.util.Locale
import kotlin.math.abs
import kotlin.math.round

val INBODY_SEGMENTS = listOf("left_arm", "right_arm", "trunk", "left_leg", "right_leg")

/** Key numbers shown on the timeline card and at the top of the sheet. */
val INBODY_HEADLINE_KEYS = listOf("inbody_score", "weight", "skeletal_muscle_mass", "percent_body_fat")

/** Readings worth a trend line across tests (the same set the web Body page offers). */
val INBODY_TREND_KEYS = listOf(
    "weight", "skeletal_muscle_mass", "body_fat_mass", "percent_body_fat", "fat_free_mass", "total_body_water",
    "protein", "minerals", "bmi", "visceral_fat_level", "basal_metabolic_rate", "waist_hip_ratio", "smi", "inbody_score"
)

/** The sections printed on the sheet, in order as plain rows; segmental and impedance readings have their own layouts. */
val INBODY_PLAIN_SECTIONS = listOf("composition", "obesity", "control", "research", "exercise")

/** The reading for a key (and segment / frequency where the sheet has them), or null when the sheet lacks it. */
fun TimelineEvent.InBody.metric(key: String, segment: String? = null, frequencyKhz: Double? = null): InBodyMetric? =
    metrics.firstOrNull { it.key == key && it.segment == segment && it.frequencyKhz == frequencyKhz }

/** Change since the previous test, rounded to the sheet's precision; null when either test lacks the reading. */
fun TimelineEvent.InBody.delta(previous: TimelineEvent.InBody?, key: String): Double? {
    val now = metric(key)?.value ?: return null
    val before = previous?.metric(key)?.value ?: return null
    return round((now - before) * 100) / 100
}

/** Signed change for display ("+1.1", "−0.4"); empty for no change. */
fun formatDelta(value: Double?): String {
    if (value == null || value == 0.0) return ""
    val sign = if (value > 0) "+" else "−"
    return sign + formatReading(abs(value))
}

/** A reading without a pointless ".0" and at most two decimals, in the device locale. */
fun formatReading(value: Double): String {
    val rounded = round(value * 100) / 100
    return if (rounded == round(rounded)) {
        String.format(Locale.getDefault(), "%d", rounded.toLong())
    } else {
        String.format(Locale.getDefault(), "%.2f", rounded).trimEnd('0').trimEnd('.', ',')
    }
}

/** The unit as printed on the card; the sheet's score has the unit "points", which reads better without. */
fun InBodyMetric.displayUnit(): String = if (unit == null || unit == "points") "" else unit

/** Tests oldest-first from a newest-first event list (the timeline order), for trends and "previous test". */
fun List<TimelineEvent>.inBodyTestsOldestFirst(): List<TimelineEvent.InBody> =
    filterIsInstance<TimelineEvent.InBody>().sortedBy { it.parsedDate }

fun List<TimelineEvent.InBody>.previousOf(event: TimelineEvent.InBody): TimelineEvent.InBody? {
    val index = indexOfFirst { it.id == event.id }
    return if (index > 0) this[index - 1] else null
}

// ---- GET api/body/inbody: what happened between two tests ------------------------------------------------------

@Serializable
data class BodyTestsResponse(val tests: List<BodyTest> = emptyList())

@Serializable
data class BodyTest(
    val id: String,
    val date: String,
    val interval: BodyInterval? = null,
    val photos: List<BodyNearbyPhoto> = emptyList(),
    val measurement: BodyNearbyMeasurement? = null
)

@Serializable
data class BodyInterval(
    val fromDate: String,
    val toDate: String,
    val days: Int,
    val nutrition: BodyNutrition? = null,
    val steps: BodySteps? = null,
    val workouts: BodyWorkouts = BodyWorkouts()
)

@Serializable
data class BodyNutrition(
    val loggedDays: Int,
    val avgKcal: Double? = null,
    val avgProteinG: Double? = null,
    val avgFatG: Double? = null,
    val avgCarbsG: Double? = null
)

@Serializable
data class BodySteps(val days: Int, val avgSteps: Int)

@Serializable
data class BodyWorkouts(val count: Int = 0, val setCount: Int = 0, val tonnageKg: Int = 0)

@Serializable
data class BodyNearbyPhoto(val eventId: String, val date: String, val daysFromTest: Int)

@Serializable
data class BodyNearbyMeasurement(
    val eventId: String,
    val date: String,
    val daysFromTest: Int,
    val values: Map<String, Double> = emptyMap()
)
