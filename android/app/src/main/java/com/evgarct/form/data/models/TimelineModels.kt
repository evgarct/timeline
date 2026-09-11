package com.evgarct.form.data.models

import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.buildClassSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.math.abs

@Serializable
data class PhotoItem(
    val id: String,
    val assetId: String? = null,
    val url: String? = null,
    val thumbnailUrl: String? = null,
    val width: Int? = null,
    val height: Int? = null,
    val alt: String = ""
)

@Serializable
data class BodyMeasurements(
    val weightKg: Double? = null,
    val waistCm: Double? = null,
    val abdomenCm: Double? = null,
    val chestCm: Double? = null,
    val neckCm: Double? = null,
    val hipsCm: Double? = null,
    val forearmCm: Double? = null,
    val leftBicepCm: Double? = null,
    val rightBicepCm: Double? = null,
    val leftBicepFlexedCm: Double? = null,
    val rightBicepFlexedCm: Double? = null,
    val leftThighCm: Double? = null,
    val rightThighCm: Double? = null,
    val leftCalfCm: Double? = null,
    val rightCalfCm: Double? = null
) {
    val hasValues: Boolean
        get() = listOf(
            weightKg, waistCm, abdomenCm, chestCm, neckCm, hipsCm, forearmCm,
            leftBicepCm, rightBicepCm, leftBicepFlexedCm, rightBicepFlexedCm,
            leftThighCm, rightThighCm, leftCalfCm, rightCalfCm
        ).any { it != null }

    // Simplified view helpers (iOS parity):
    val armRelaxed: Double? get() = leftBicepCm ?: rightBicepCm
    val armFlexed: Double? get() = leftBicepFlexedCm ?: rightBicepFlexedCm
    val thigh: Double? get() = leftThighCm ?: rightThighCm
    val calf: Double? get() = leftCalfCm ?: rightCalfCm
}

enum class DeltaDirection { INCREASED, DECREASED, UNCHANGED }

data class MeasurementDelta(
    val current: Double,
    val previous: Double?
) {
    val change: Double? get() = previous?.let { current - it }
    val direction: DeltaDirection? get() {
        val c = change ?: return null
        return when {
            abs(c) < 0.005 -> DeltaDirection.UNCHANGED
            c > 0 -> DeltaDirection.INCREASED
            else -> DeltaDirection.DECREASED
        }
    }
}

@Serializable
data class InBodyMetric(
    val key: String,
    val label: String,
    val value: Double,
    val unit: String? = null,
    val category: String? = null
)

@Serializable(with = TimelineEventSerializer::class)
sealed class TimelineEvent {
    abstract val id: String
    abstract val occurredAt: String
    abstract val timezone: String
    abstract val note: String?

    data class ProgressPhoto(
        override val id: String,
        override val occurredAt: String,
        override val timezone: String,
        override val note: String?,
        val photos: List<PhotoItem>
    ) : TimelineEvent()

    data class Measurements(
        override val id: String,
        override val occurredAt: String,
        override val timezone: String,
        override val note: String?,
        val values: BodyMeasurements
    ) : TimelineEvent()

    data class InBody(
        override val id: String,
        override val occurredAt: String,
        override val timezone: String,
        override val note: String?,
        val metrics: List<InBodyMetric>
    ) : TimelineEvent()

    data class Workout(
        override val id: String,
        override val occurredAt: String,
        override val timezone: String,
        override val note: String?,
        val completed: Boolean,
        val muscleGroups: List<String>
    ) : TimelineEvent()

    data class NutritionEntry(
        override val id: String,
        override val occurredAt: String,
        override val timezone: String,
        override val note: String?
    ) : TimelineEvent()

    data class Unsupported(
        override val id: String,
        override val occurredAt: String,
        override val timezone: String,
        override val note: String?,
        val rawType: String
    ) : TimelineEvent()

    val parsedDate: Date get() = parseIsoDate(occurredAt)
}

fun parseIsoDate(iso: String): Date {
    return try {
        val formatFractional = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        formatFractional.parse(iso) ?: Date()
    } catch (e: Exception) {
        try {
            val formatBasic = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
            formatBasic.parse(iso) ?: Date()
        } catch (e2: Exception) {
            Date()
        }
    }
}

object TimelineEventSerializer : KSerializer<TimelineEvent> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("TimelineEvent")

    override fun deserialize(decoder: Decoder): TimelineEvent {
        val jsonDecoder = decoder as? JsonDecoder
            ?: throw IllegalStateException("Can be deserialized only by JSON")
        val root = jsonDecoder.decodeJsonElement().jsonObject

        val id = root["id"]?.jsonPrimitive?.content ?: ""
        val type = root["type"]?.jsonPrimitive?.content ?: "unsupported"
        val occurredAt = root["occurredAt"]?.jsonPrimitive?.content ?: ""
        val timezone = root["timezone"]?.jsonPrimitive?.content ?: "UTC"
        val note = root["note"]?.jsonPrimitive?.contentOrNull

        return when (type) {
            "progress_photo" -> {
                val photosArray = root["photos"]?.jsonArray ?: emptyList()
                val photos = photosArray.mapNotNull {
                    try {
                        jsonDecoder.json.decodeFromJsonElement(PhotoItem.serializer(), it)
                    } catch (e: Exception) {
                        null
                    }
                }
                TimelineEvent.ProgressPhoto(id, occurredAt, timezone, note, photos)
            }
            "measurements" -> {
                val valuesObj = root["values"]?.jsonObject
                val values = if (valuesObj != null) {
                    jsonDecoder.json.decodeFromJsonElement(BodyMeasurements.serializer(), valuesObj)
                } else {
                    BodyMeasurements()
                }
                TimelineEvent.Measurements(id, occurredAt, timezone, note, values)
            }
            "inbody" -> {
                val metricsArray = root["metrics"]?.jsonArray ?: emptyList()
                val metrics = metricsArray.mapNotNull {
                    try {
                        jsonDecoder.json.decodeFromJsonElement(InBodyMetric.serializer(), it)
                    } catch (e: Exception) {
                        null
                    }
                }
                TimelineEvent.InBody(id, occurredAt, timezone, note, metrics)
            }
            "workout" -> {
                val completed = root["completed"]?.jsonPrimitive?.booleanOrNull ?: false
                val muscleGroups = root["muscleGroups"]?.jsonArray?.mapNotNull { it.jsonPrimitive.contentOrNull } ?: emptyList()
                TimelineEvent.Workout(id, occurredAt, timezone, note, completed, muscleGroups)
            }
            "nutrition_entry" -> {
                TimelineEvent.NutritionEntry(id, occurredAt, timezone, note)
            }
            else -> {
                TimelineEvent.Unsupported(id, occurredAt, timezone, note, type)
            }
        }
    }

    override fun serialize(encoder: Encoder, value: TimelineEvent) {
        // Serialization used when creating events
    }
}
