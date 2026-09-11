package com.evgarct.form.data.models

import org.junit.Assert.assertEquals
import org.junit.Test

class NutritionModelsTest {

    @Test
    fun testNutritionSummaryFromNutrients() {
        val nutrients = listOf(
            NutrientValue(key = "energy_kcal", label = "Calories", value = 250.0),
            NutrientValue(key = "protein", label = "Protein", value = 20.0),
            NutrientValue(key = "fat", label = "Fat", value = 10.0),
            NutrientValue(key = "carbohydrates", label = "Carbs", value = 15.0)
        )
        val summary = NutritionSummary.fromNutrients(nutrients)
        assertEquals(250.0, summary.calories, 0.01)
        assertEquals(20.0, summary.protein, 0.01)
        assertEquals(10.0, summary.fat, 0.01)
        assertEquals(15.0, summary.carbohydrates, 0.01)
    }

    @Test
    fun testNutritionSummaryFromEntries() {
        val entry1 = FoodEntry(
            id = "1",
            occurredAt = "2026-09-11T08:00:00Z",
            timezone = "UTC",
            mealType = MealType.BREAKFAST,
            quantity = FoodQuantity.Grams(100.0),
            productSnapshot = FoodProductSnapshot(
                name = "Eggs",
                nutrients = listOf(
                    NutrientValue(key = "energy_kcal", label = "Calories", value = 140.0),
                    NutrientValue(key = "protein", label = "Protein", value = 12.0),
                    NutrientValue(key = "fat", label = "Fat", value = 10.0),
                    NutrientValue(key = "carbohydrates", label = "Carbs", value = 1.0)
                )
            )
        )
        val entry2 = FoodEntry(
            id = "2",
            occurredAt = "2026-09-11T08:30:00Z",
            timezone = "UTC",
            mealType = MealType.BREAKFAST,
            quantity = FoodQuantity.Grams(50.0),
            productSnapshot = FoodProductSnapshot(
                name = "Bread",
                nutrients = listOf(
                    NutrientValue(key = "energy_kcal", label = "Calories", value = 130.0),
                    NutrientValue(key = "protein", label = "Protein", value = 4.0),
                    NutrientValue(key = "fat", label = "Fat", value = 1.0),
                    NutrientValue(key = "carbohydrates", label = "Carbs", value = 25.0)
                )
            )
        )

        val summary = NutritionSummary.fromEntries(listOf(entry1, entry2))
        assertEquals(270.0, summary.calories, 0.01)
        assertEquals(16.0, summary.protein, 0.01)
        assertEquals(11.0, summary.fat, 0.01)
        assertEquals(26.0, summary.carbohydrates, 0.01)
    }
}
