package com.evgarct.form.ui.nutrition.report

import com.evgarct.form.data.models.DailyNutritionTotal
import com.evgarct.form.data.models.FoodEntry
import com.evgarct.form.data.models.MealType
import com.evgarct.form.data.models.NutritionGoals
import com.evgarct.form.data.models.NutritionReportPayload
import com.evgarct.form.data.models.NutritionReportSummary
import com.evgarct.form.data.models.NutritionSummary
import com.evgarct.form.data.models.WeeklyNutritionSnapshot
import com.evgarct.form.data.repository.ActivityDataState
import com.evgarct.form.data.repository.HealthConnectRepository
import com.evgarct.form.data.repository.NutritionRepository
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import java.time.LocalDate
import java.time.ZoneId
import java.util.Calendar
import java.util.Date
import java.util.TimeZone

object NutritionReportBuilder {

    suspend fun buildPayload(
        selectedDate: Date,
        entries: List<FoodEntry>,
        timezone: TimeZone,
        stepGoal: Int,
        goals: NutritionGoals,
        nutritionRepo: NutritionRepository,
        healthRepo: HealthConnectRepository
    ): NutritionReportPayload = coroutineScope {
        val activityDeferred = async {
            try {
                val localDate = selectedDate.toInstant()
                    .atZone(timezone.toZoneId())
                    .toLocalDate()
                val state = healthRepo.getActivityData(localDate, stepGoal)
                if (state is ActivityDataState.Value) state else null
            } catch (e: Exception) {
                null
            }
        }

        val weeklyNutritionDeferred = async {
            fetchWeeklyNutrition(selectedDate, entries, timezone, nutritionRepo)
        }

        val activity = activityDeferred.await()
        val weeklyNutrition = weeklyNutritionDeferred.await()

        val entriesByMeal = entries.groupBy { it.mealType }
        val summary = NutritionReportSummary.fromEntries(entries)

        NutritionReportPayload(
            date = selectedDate,
            entries = entries,
            entriesByMeal = entriesByMeal,
            summary = summary,
            activity = activity,
            stepGoal = stepGoal,
            goals = goals,
            weeklyNutrition = weeklyNutrition
        )
    }

    private suspend fun fetchWeeklyNutrition(
        selectedDate: Date,
        currentEntries: List<FoodEntry>,
        timezone: TimeZone,
        nutritionRepo: NutritionRepository
    ): WeeklyNutritionSnapshot = coroutineScope {
        val cal = Calendar.getInstance(timezone).apply {
            firstDayOfWeek = Calendar.MONDAY
            time = selectedDate
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val normalizedSelected = cal.time

        // Find Monday of this week
        val dayOfWeek = cal.get(Calendar.DAY_OF_WEEK)
        val daysFromMonday = if (dayOfWeek == Calendar.SUNDAY) 6 else dayOfWeek - Calendar.MONDAY
        cal.add(Calendar.DAY_OF_YEAR, -daysFromMonday)
        val monday = cal.time

        val todayCal = Calendar.getInstance(timezone).apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val today = todayCal.time

        val dayTasks = (0..6).map { offset ->
            val dayCal = Calendar.getInstance(timezone).apply {
                time = monday
                add(Calendar.DAY_OF_YEAR, offset)
            }
            val dayDate = dayCal.time

            async {
                if (dayDate.after(today)) {
                    DailyNutritionTotal(date = dayDate, summary = null)
                } else if (dayDate == normalizedSelected) {
                    DailyNutritionTotal(date = dayDate, summary = NutritionSummary.fromEntries(currentEntries))
                } else {
                    val entriesResult = nutritionRepo.getEntries(dayDate, timezone)
                    val summary = entriesResult.getOrNull()?.let { NutritionSummary.fromEntries(it) }
                    DailyNutritionTotal(date = dayDate, summary = summary)
                }
            }
        }

        val days = dayTasks.awaitAll()
        WeeklyNutritionSnapshot(days = days, selectedDate = normalizedSelected)
    }
}
