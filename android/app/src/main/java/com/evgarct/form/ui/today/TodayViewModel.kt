package com.evgarct.form.ui.today

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.evgarct.form.FormApp
import com.evgarct.form.data.cache.ActivityCache
import com.evgarct.form.data.cache.NutritionCache
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.util.Date
import java.util.TimeZone

/**
 * Combines [NutritionCache] and [ActivityCache] for the Today screen so both
 * summary columns show last-known data immediately and refresh in the background,
 * instead of flashing to zero on every tab switch.
 */
class TodayViewModel : ViewModel() {

    private val nutritionCache = FormApp.instance.nutritionCache
    private val activityCache = FormApp.instance.activityCache
    private val prefs = FormApp.instance.appPreferences

    val nutritionState: StateFlow<Map<String, NutritionCache.DayState>> = nutritionCache.state
    val activityState: StateFlow<Map<String, ActivityCache.DayState>> = activityCache.state

    fun nutritionDayState(date: Date = Date(), timezone: TimeZone = TimeZone.getDefault()): NutritionCache.DayState =
        nutritionCache.stateFor(date, timezone)

    fun activityDayState(date: LocalDate = LocalDate.now(), goal: Int = prefs.stepGoal): ActivityCache.DayState =
        activityCache.stateFor(date, goal)

    fun refresh(force: Boolean = false) {
        viewModelScope.launch { nutritionCache.refresh(Date(), TimeZone.getDefault(), force) }
        viewModelScope.launch { activityCache.refresh(LocalDate.now(), prefs.stepGoal, force) }
    }
}
