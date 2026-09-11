package com.evgarct.form.data.models

import com.evgarct.form.data.repository.ActivityDataState
import java.util.Date

data class NutritionReportSummary(
    var calories: Double = 0.0,
    var protein: Double = 0.0,
    var fat: Double = 0.0,
    var carbohydrates: Double = 0.0,
    var fiber: Double = 0.0,
    var sugars: Double = 0.0,
    var saturatedFat: Double = 0.0,
    var hasFiber: Boolean = false,
    var hasSugars: Boolean = false,
    var hasSaturatedFat: Boolean = false
) {
    val unsaturatedFat: Double get() = maxOf(fat - saturatedFat, 0.0)
    val complexCarbs: Double get() = maxOf(carbohydrates - sugars, 0.0)

    companion object {
        fun fromEntries(entries: List<FoodEntry>): NutritionReportSummary =
            fromNutrients(entries.flatMap { it.productSnapshot.nutrients })

        fun fromNutrients(nutrients: List<NutrientValue>): NutritionReportSummary {
            val summary = NutritionReportSummary()
            for (nutrient in nutrients) {
                val value = nutrient.value ?: continue
                when (nutrient.key) {
                    "energy_kcal" -> summary.calories += value
                    "protein" -> summary.protein += value
                    "fat" -> summary.fat += value
                    "carbohydrates" -> summary.carbohydrates += value
                    "fiber" -> {
                        summary.fiber += value
                        summary.hasFiber = true
                    }
                    "sugars" -> {
                        summary.sugars += value
                        summary.hasSugars = true
                    }
                    "saturated_fat" -> {
                        summary.saturatedFat += value
                        summary.hasSaturatedFat = true
                    }
                }
            }
            return summary
        }
    }
}

data class DailyNutritionTotal(
    val date: Date,
    val summary: NutritionSummary?
)

data class WeeklyNutritionSnapshot(
    val days: List<DailyNutritionTotal>,
    val selectedDate: Date
) {
    private val loggedSummaries: List<NutritionSummary>
        get() = days.mapNotNull { it.summary }

    val averageCalories: Double
        get() = if (loggedSummaries.isEmpty()) 0.0 else loggedSummaries.sumOf { it.calories } / loggedSummaries.size

    val averageProtein: Double
        get() = if (loggedSummaries.isEmpty()) 0.0 else loggedSummaries.sumOf { it.protein } / loggedSummaries.size

    val averageFat: Double
        get() = if (loggedSummaries.isEmpty()) 0.0 else loggedSummaries.sumOf { it.fat } / loggedSummaries.size

    val averageCarbohydrates: Double
        get() = if (loggedSummaries.isEmpty()) 0.0 else loggedSummaries.sumOf { it.carbohydrates } / loggedSummaries.size
}

data class NutritionReportPayload(
    val date: Date,
    val entries: List<FoodEntry>,
    val entriesByMeal: Map<MealType, List<FoodEntry>>,
    val summary: NutritionReportSummary,
    val activity: ActivityDataState.Value?,
    val stepGoal: Int,
    val goals: NutritionGoals,
    val weeklyNutrition: WeeklyNutritionSnapshot?
) {
    fun entries(meal: MealType): List<FoodEntry> = entriesByMeal[meal] ?: emptyList()

    fun summary(meal: MealType): NutritionReportSummary =
        NutritionReportSummary.fromEntries(entries(meal))
}
