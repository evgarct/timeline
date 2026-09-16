package com.evgarct.form.data.repository

import androidx.health.connect.client.records.MealType
import androidx.health.connect.client.records.NutritionRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.units.Energy
import androidx.health.connect.client.units.Mass
import com.evgarct.form.data.models.FoodEntry
import com.evgarct.form.data.models.MealType as FormMealType
import com.evgarct.form.data.models.NutrientValue
import java.text.SimpleDateFormat
import java.time.Instant
import java.time.ZoneOffset
import java.util.Locale
import java.util.TimeZone

/**
 * Maps Form's backend-sourced [FoodEntry]/[NutrientValue] shape onto Health Connect's
 * [NutritionRecord]. Pure function, no [androidx.health.connect.client.HealthConnectClient]
 * dependency, so it's unit-testable without mocking Health Connect.
 */
object NutritionRecordMapper {

    private val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    fun map(entry: FoodEntry): NutritionRecord {
        val instant = parseOccurredAt(entry.occurredAt)
        val zoneOffset = ZoneOffset.UTC
        val builder = NutritionRecordBuilder()

        for (nutrient in entry.productSnapshot.nutrients) {
            applyNutrient(builder, nutrient)
        }

        return NutritionRecord(
            startTime = instant,
            startZoneOffset = zoneOffset,
            // Health Connect requires startTime < endTime; nutrition entries aren't naturally an
            // interval, so use the smallest possible duration to represent a point-in-time log.
            endTime = instant.plusMillis(1),
            endZoneOffset = zoneOffset,
            // Version must be monotonically increasing for Health Connect to accept a re-upsert
            // (e.g. an edited entry) as a replace rather than ignoring it. entry.occurredAt can
            // stay the same across an edit, so wall-clock time at write time is used instead.
            metadata = Metadata.manualEntry(
                clientRecordId = entry.id,
                clientRecordVersion = System.currentTimeMillis()
            ),
            mealType = toHealthConnectMealType(entry.mealType),
            name = entry.productSnapshot.name,
            energy = builder.energy,
            energyFromFat = null,
            biotin = builder.biotin,
            caffeine = builder.caffeine,
            calcium = builder.calcium,
            chloride = builder.chloride,
            cholesterol = builder.cholesterol,
            chromium = builder.chromium,
            copper = builder.copper,
            dietaryFiber = builder.dietaryFiber,
            folate = builder.folate,
            folicAcid = builder.folicAcid,
            iodine = builder.iodine,
            iron = builder.iron,
            magnesium = builder.magnesium,
            manganese = builder.manganese,
            molybdenum = builder.molybdenum,
            monounsaturatedFat = builder.monounsaturatedFat,
            niacin = builder.niacin,
            pantothenicAcid = builder.pantothenicAcid,
            phosphorus = builder.phosphorus,
            polyunsaturatedFat = builder.polyunsaturatedFat,
            potassium = builder.potassium,
            protein = builder.protein,
            riboflavin = builder.riboflavin,
            saturatedFat = builder.saturatedFat,
            selenium = builder.selenium,
            sodium = builder.sodium,
            sugar = builder.sugar,
            thiamin = builder.thiamin,
            totalCarbohydrate = builder.totalCarbohydrate,
            totalFat = builder.totalFat,
            transFat = builder.transFat,
            unsaturatedFat = builder.unsaturatedFat,
            vitaminA = builder.vitaminA,
            vitaminB12 = builder.vitaminB12,
            vitaminB6 = builder.vitaminB6,
            vitaminC = builder.vitaminC,
            vitaminD = builder.vitaminD,
            vitaminE = builder.vitaminE,
            vitaminK = builder.vitaminK,
            zinc = builder.zinc
        )
    }

    fun parseOccurredAt(occurredAt: String): Instant {
        return try {
            isoFormat.parse(occurredAt)?.toInstant() ?: Instant.now()
        } catch (e: Exception) {
            Instant.now()
        }
    }

    private fun toHealthConnectMealType(mealType: FormMealType): Int = when (mealType) {
        FormMealType.BREAKFAST -> MealType.MEAL_TYPE_BREAKFAST
        FormMealType.LUNCH -> MealType.MEAL_TYPE_LUNCH
        FormMealType.DINNER -> MealType.MEAL_TYPE_DINNER
        FormMealType.SNACK -> MealType.MEAL_TYPE_SNACK
    }

    /** Mutable scratch holder so [map] can build up fields via the shared [applyNutrient] table. */
    private class NutritionRecordBuilder {
        var energy: Energy? = null
        var biotin: Mass? = null
        var caffeine: Mass? = null
        var calcium: Mass? = null
        var chloride: Mass? = null
        var cholesterol: Mass? = null
        var chromium: Mass? = null
        var copper: Mass? = null
        var dietaryFiber: Mass? = null
        var folate: Mass? = null
        var folicAcid: Mass? = null
        var iodine: Mass? = null
        var iron: Mass? = null
        var magnesium: Mass? = null
        var manganese: Mass? = null
        var molybdenum: Mass? = null
        var monounsaturatedFat: Mass? = null
        var niacin: Mass? = null
        var pantothenicAcid: Mass? = null
        var phosphorus: Mass? = null
        var polyunsaturatedFat: Mass? = null
        var potassium: Mass? = null
        var protein: Mass? = null
        var riboflavin: Mass? = null
        var saturatedFat: Mass? = null
        var selenium: Mass? = null
        var sodium: Mass? = null
        var sugar: Mass? = null
        var thiamin: Mass? = null
        var totalCarbohydrate: Mass? = null
        var totalFat: Mass? = null
        var transFat: Mass? = null
        var unsaturatedFat: Mass? = null
        var vitaminA: Mass? = null
        var vitaminB12: Mass? = null
        var vitaminB6: Mass? = null
        var vitaminC: Mass? = null
        var vitaminD: Mass? = null
        var vitaminE: Mass? = null
        var vitaminK: Mass? = null
        var zinc: Mass? = null
    }

    private fun applyNutrient(builder: NutritionRecordBuilder, nutrient: NutrientValue) {
        val key = nutrient.key ?: return
        val value = nutrient.value ?: return
        if (value < 0) return

        if (key == "energy_kcal") {
            builder.energy = Energy.kilocalories(value)
            return
        }

        val mass = toMass(value, nutrient.unit) ?: return

        when (key) {
            "protein" -> builder.protein = mass
            "fat" -> builder.totalFat = mass
            "carbohydrates" -> builder.totalCarbohydrate = mass
            "saturated_fat" -> builder.saturatedFat = mass
            "trans_fat" -> builder.transFat = mass
            "monounsaturated_fat" -> builder.monounsaturatedFat = mass
            "polyunsaturated_fat" -> builder.polyunsaturatedFat = mass
            "unsaturated_fat" -> builder.unsaturatedFat = mass
            "fiber" -> builder.dietaryFiber = mass
            "sugars", "sugar" -> builder.sugar = mass
            "sodium" -> builder.sodium = mass
            "cholesterol" -> builder.cholesterol = mass
            "potassium" -> builder.potassium = mass
            "calcium" -> builder.calcium = mass
            "iron" -> builder.iron = mass
            "magnesium" -> builder.magnesium = mass
            "manganese" -> builder.manganese = mass
            "phosphorus" -> builder.phosphorus = mass
            "zinc" -> builder.zinc = mass
            "chloride" -> builder.chloride = mass
            "chromium" -> builder.chromium = mass
            "copper" -> builder.copper = mass
            "folate" -> builder.folate = mass
            "folic_acid" -> builder.folicAcid = mass
            "iodine" -> builder.iodine = mass
            "molybdenum" -> builder.molybdenum = mass
            "niacin" -> builder.niacin = mass
            "pantothenic_acid" -> builder.pantothenicAcid = mass
            "riboflavin" -> builder.riboflavin = mass
            "selenium" -> builder.selenium = mass
            "thiamin" -> builder.thiamin = mass
            "biotin" -> builder.biotin = mass
            "caffeine" -> builder.caffeine = mass
            "vitamin_a" -> builder.vitaminA = mass
            "vitamin_b6" -> builder.vitaminB6 = mass
            "vitamin_b12" -> builder.vitaminB12 = mass
            "vitamin_c" -> builder.vitaminC = mass
            "vitamin_d" -> builder.vitaminD = mass
            "vitamin_e" -> builder.vitaminE = mass
            "vitamin_k" -> builder.vitaminK = mass
            else -> Unit // unmapped key, no Health Connect field to carry it
        }
    }

    /** Health Connect nutrient fields are all [Mass]; normalize Form's string unit onto it. */
    private fun toMass(value: Double, unit: String): Mass? = when (unit.lowercase()) {
        "g" -> Mass.grams(value)
        "mg" -> Mass.milligrams(value)
        "mcg", "µg", "ug" -> Mass.micrograms(value)
        "kg" -> Mass.kilograms(value)
        else -> null
    }
}
