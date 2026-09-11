package com.evgarct.form.data.models

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.buildClassSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonEncoder
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

@Serializable
enum class NutrientProvenance {
    @SerialName("stated") STATED,
    @SerialName("calculated") CALCULATED,
    @SerialName("estimated") ESTIMATED
}

@Serializable
data class NutrientValue(
    val key: String? = null,
    val label: String,
    val value: Double? = null,
    val unit: String = "g",
    val qualifier: String? = null,
    val originalText: String? = null,
    val dailyValuePercent: Double? = null,
    val provenance: NutrientProvenance = NutrientProvenance.STATED
) {
    val id: String get() = "${key ?: label}-$unit-$label"
}

@Serializable
data class NutrientBase(
    val id: String = "100g",
    val label: String = "per 100g",
    val amount: Double = 100.0,
    val unit: String = "g",
    val nutrients: List<NutrientValue> = emptyList()
)

@Serializable
data class PieceSizeOption(
    val size: String,
    val grams: Double,
    val provenance: NutrientProvenance = NutrientProvenance.STATED
)

@Serializable
data class ServingSizeOption(
    val id: String? = null,
    val label: String,
    val amount: Double,
    val provenance: NutrientProvenance = NutrientProvenance.STATED
)

@Serializable
data class LocalizedText(
    val en: String? = null,
    val ru: String? = null,
    val cs: String? = null
) {
    fun resolve(lang: String): String? {
        return when (lang) {
            "ru" -> ru ?: en ?: cs
            "cs" -> cs ?: en ?: ru
            else -> en ?: ru ?: cs
        }
    }
}

@Serializable
data class NutritionProduct(
    val id: String,
    val name: String,
    val brand: String? = null,
    val barcode: String? = null,
    val baseUnit: String = "g",
    val nutrientBases: List<NutrientBase> = emptyList(),
    val pieceSizes: List<PieceSizeOption> = emptyList(),
    val servingSizes: List<ServingSizeOption> = emptyList(),
    val type: LocalizedText? = null,
    val genericName: LocalizedText? = null
) {
    val referenceBase: NutrientBase?
        get() = nutrientBases.firstOrNull { it.unit == baseUnit } ?: nutrientBases.firstOrNull()

    val referenceSummary: NutritionSummary
        get() = NutritionSummary.fromNutrients(referenceBase?.nutrients ?: emptyList())

    val alternateBases: List<NutrientBase>
        get() = nutrientBases.filter { it.unit == baseUnit && it.id != referenceBase?.id }

    fun summaryFor(quantity: FoodQuantity): NutritionSummary {
        val base = referenceBase ?: return NutritionSummary()
        if (base.amount <= 0) return NutritionSummary()

        val amountInBase: Double = when (quantity) {
            is FoodQuantity.Grams -> quantity.amount
            is FoodQuantity.Milliliters -> quantity.amount
            is FoodQuantity.Pieces -> {
                val opt = pieceSizes.firstOrNull { it.size == quantity.size } ?: return NutritionSummary()
                opt.grams * quantity.amount
            }
            is FoodQuantity.Serving -> {
                val opt = quantity.servingSizeId?.let { id -> servingSizes.firstOrNull { it.id == id } }
                    ?: quantity.label?.let { l -> servingSizes.firstOrNull { it.label == l } }
                    ?: return NutritionSummary()
                opt.amount * quantity.amount
            }
            is FoodQuantity.AsConsumed -> return NutritionSummary()
        }

        val multiplier = amountInBase / base.amount
        val scaled = base.nutrients.map { nutrient ->
            nutrient.copy(value = nutrient.value?.let { it * multiplier })
        }
        return NutritionSummary.fromNutrients(scaled)
    }
}

@Serializable(with = FoodQuantitySerializer::class)
sealed class FoodQuantity {
    abstract val amount: Double
    abstract val unitLabel: String

    data class Grams(override val amount: Double) : FoodQuantity() {
        override val unitLabel: String = "g"
    }

    data class Milliliters(override val amount: Double) : FoodQuantity() {
        override val unitLabel: String = "ml"
    }

    data class Pieces(override val amount: Double, val size: String) : FoodQuantity() {
        override val unitLabel: String = size
    }

    data class Serving(override val amount: Double, val label: String?, val servingSizeId: String?) : FoodQuantity() {
        override val unitLabel: String = label ?: servingSizeId ?: "serving"
    }

    data class AsConsumed(val label: String) : FoodQuantity() {
        override val amount: Double = 1.0
        override val unitLabel: String = label
    }
}

object FoodQuantitySerializer : KSerializer<FoodQuantity> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("FoodQuantity")

    override fun deserialize(decoder: Decoder): FoodQuantity {
        val jsonDecoder = decoder as? JsonDecoder ?: throw IllegalStateException("JSON required")
        val obj = jsonDecoder.decodeJsonElement().jsonObject
        val unit = obj["unit"]?.jsonPrimitive?.content ?: "g"
        val amount = obj["amount"]?.jsonPrimitive?.doubleOrNull ?: 1.0

        return when (unit) {
            "g" -> FoodQuantity.Grams(amount)
            "ml" -> FoodQuantity.Milliliters(amount)
            "piece" -> FoodQuantity.Pieces(amount, obj["size"]?.jsonPrimitive?.content ?: "1 piece")
            "serving" -> FoodQuantity.Serving(
                amount,
                obj["label"]?.jsonPrimitive?.contentOrNull,
                obj["servingSizeId"]?.jsonPrimitive?.contentOrNull
            )
            "as_consumed" -> FoodQuantity.AsConsumed(obj["label"]?.jsonPrimitive?.content ?: "")
            else -> FoodQuantity.Grams(amount)
        }
    }

    override fun serialize(encoder: Encoder, value: FoodQuantity) {
        val jsonEncoder = encoder as? JsonEncoder ?: throw IllegalStateException("JSON required")
        val obj = buildJsonObject {
            when (value) {
                is FoodQuantity.Grams -> {
                    put("unit", "g")
                    put("amount", value.amount)
                }
                is FoodQuantity.Milliliters -> {
                    put("unit", "ml")
                    put("amount", value.amount)
                }
                is FoodQuantity.Pieces -> {
                    put("unit", "piece")
                    put("amount", value.amount)
                    put("size", value.size)
                }
                is FoodQuantity.Serving -> {
                    put("unit", "serving")
                    put("amount", value.amount)
                    value.label?.let { put("label", it) }
                    value.servingSizeId?.let { put("servingSizeId", it) }
                }
                is FoodQuantity.AsConsumed -> {
                    put("unit", "as_consumed")
                    put("label", value.label)
                }
            }
        }
        jsonEncoder.encodeJsonElement(obj)
    }
}

@Serializable
enum class MealType {
    @SerialName("breakfast") BREAKFAST,
    @SerialName("lunch") LUNCH,
    @SerialName("dinner") DINNER,
    @SerialName("snack") SNACK
}

@Serializable
data class FoodBaseAmount(
    val amount: Double,
    val unit: String
)

@Serializable
data class FoodProductSnapshot(
    val name: String,
    val brand: String? = null,
    val nutrients: List<NutrientValue> = emptyList(),
    val type: LocalizedText? = null,
    val genericName: LocalizedText? = null,
    val baseAmount: FoodBaseAmount? = null
)

@Serializable
data class FoodEntry(
    val id: String,
    val type: String = "nutrition_entry",
    val occurredAt: String,
    val timezone: String,
    val note: String? = null,
    val productId: String? = null,
    val mealType: MealType,
    val quantity: FoodQuantity,
    val productSnapshot: FoodProductSnapshot
)

@Serializable
data class ProductSearchPage(
    val items: List<NutritionProduct> = emptyList(),
    val page: Int = 1,
    val pageSize: Int = 30,
    val hasMore: Boolean = false
)

data class NutritionSummary(
    var calories: Double = 0.0,
    var protein: Double = 0.0,
    var fat: Double = 0.0,
    var carbohydrates: Double = 0.0
) {
    companion object {
        fun fromEntries(entries: List<FoodEntry>): NutritionSummary =
            fromNutrients(entries.flatMap { it.productSnapshot.nutrients })

        fun fromNutrients(nutrients: List<NutrientValue>): NutritionSummary {
            var calories = 0.0
            var protein = 0.0
            var fat = 0.0
            var carbohydrates = 0.0
            for (n in nutrients) {
                val v = n.value ?: continue
                when (n.key) {
                    "energy_kcal" -> calories += v
                    "protein" -> protein += v
                    "fat" -> fat += v
                    "carbohydrates" -> carbohydrates += v
                }
            }
            return NutritionSummary(calories, protein, fat, carbohydrates)
        }
    }
}

data class NutritionGoals(
    val calories: Double? = null,
    val protein: Double? = null,
    val fat: Double? = null,
    val carbohydrates: Double? = null
)

sealed class GoalStatus {
    object OnTarget : GoalStatus()
    data class Under(val diff: Double) : GoalStatus()
    data class Over(val diff: Double) : GoalStatus()

    companion object {
        fun compute(actual: Double, goal: Double): GoalStatus {
            if (goal <= 0) return OnTarget
            val ratio = actual / goal
            return when {
                ratio < 0.9 -> Under(goal - actual)
                ratio > 1.1 -> Over(actual - goal)
                else -> OnTarget
            }
        }
    }
}
