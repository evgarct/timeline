package com.evgarct.form.ui.nutrition

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.evgarct.form.FormApp
import com.evgarct.form.data.cache.NutritionCache
import com.evgarct.form.data.models.FoodEntry
import com.evgarct.form.data.models.FoodProductSnapshot
import com.evgarct.form.data.models.FoodQuantity
import com.evgarct.form.data.models.MealType
import com.evgarct.form.data.models.NutritionProduct
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.util.Date
import java.util.TimeZone
import java.util.UUID

/**
 * Thin ViewModel over [NutritionCache]: screens read [cacheState] and call the
 * mutation methods here instead of the repository directly, so every add/update/
 * delete is optimistic and immediately visible to every screen sharing the cache.
 */
class NutritionViewModel : ViewModel() {

    private val repository = FormApp.instance.nutritionRepository
    private val cache = FormApp.instance.nutritionCache

    val cacheState: StateFlow<Map<String, NutritionCache.DayState>> = cache.state

    /** Collapsed meal-section names, kept here (not in the composable) so it survives tab switches. */
    var collapsedMeals by mutableStateOf(emptySet<String>())
        private set

    fun toggleMealCollapsed(meal: MealType) {
        collapsedMeals = if (meal.name in collapsedMeals) collapsedMeals - meal.name else collapsedMeals + meal.name
    }

    /** Meal names currently repeating from yesterday, so the header can show a small in-place spinner. */
    var repeatingMeals by mutableStateOf(emptySet<String>())
        private set

    /** The "repeat this whole meal" case: pulls yesterday's items for [meal] into [targetDate] (today by default). */
    fun repeatMealFromYesterday(meal: MealType, targetDate: Date = Date(), timezone: TimeZone = TimeZone.getDefault()) {
        if (meal.name in repeatingMeals) return
        val sourceCal = java.util.Calendar.getInstance().apply { time = targetDate; add(java.util.Calendar.DAY_OF_YEAR, -1) }
        repeatingMeals = repeatingMeals + meal.name
        viewModelScope.launch {
            repository.repeatMeal(meal, sourceCal.time, targetDate, timezone)
                .onSuccess { newEntries ->
                    newEntries.forEach { cache.applyOptimisticUpsert(targetDate, timezone, it) }
                }
            repeatingMeals = repeatingMeals - meal.name
        }
    }

    fun dayState(date: Date, timezone: TimeZone = TimeZone.getDefault()): NutritionCache.DayState =
        cache.stateFor(date, timezone)

    fun refresh(date: Date, timezone: TimeZone = TimeZone.getDefault(), force: Boolean = false) {
        viewModelScope.launch { cache.refresh(date, timezone, force) }
    }

    /** Builds a client-side entry immediately so the list updates before the network call returns. */
    fun addEntryOptimistic(
        product: NutritionProduct,
        mealType: MealType,
        quantity: FoodQuantity,
        date: Date,
        timezone: TimeZone = TimeZone.getDefault()
    ) {
        val tempId = "pending-${UUID.randomUUID()}"
        val tempEntry = FoodEntry(
            id = tempId,
            occurredAt = isoNow(),
            timezone = timezone.id,
            productId = product.id,
            mealType = mealType,
            quantity = quantity,
            productSnapshot = FoodProductSnapshot(
                name = product.name,
                brand = product.brand,
                nutrients = product.scaledNutrients(quantity),
                type = product.type,
                genericName = product.genericName
            )
        )
        cache.applyOptimisticUpsert(date, timezone, tempEntry)
        viewModelScope.launch {
            repository.recordEntry(product.id, mealType, quantity, date, timezone)
                .onSuccess { real -> cache.replaceOptimistic(date, timezone, tempId, real) }
                .onFailure { cache.applyOptimisticRemove(date, timezone, tempId) }
        }
    }

    /** Repeats a single logged item (not the whole meal) to [targetDate], today by default. */
    fun repeatEntry(entry: FoodEntry, targetDate: Date = Date(), timezone: TimeZone = TimeZone.getDefault()) {
        val tempId = "pending-${UUID.randomUUID()}"
        val tempEntry = entry.copy(id = tempId, occurredAt = isoNow(), timezone = timezone.id)
        cache.applyOptimisticUpsert(targetDate, timezone, tempEntry)
        viewModelScope.launch {
            repository.recordEntry(entry.productId, entry.mealType, entry.quantity, targetDate, timezone)
                .onSuccess { real -> cache.replaceOptimistic(targetDate, timezone, tempId, real) }
                .onFailure { cache.applyOptimisticRemove(targetDate, timezone, tempId) }
        }
    }

    /** [oldDate]/[newDate] can differ when the edit also moves the entry to another day. */
    fun updateEntryOptimistic(
        previous: FoodEntry,
        mealType: MealType,
        quantity: FoodQuantity,
        oldDate: Date,
        newDate: Date,
        timezone: TimeZone = TimeZone.getDefault()
    ) {
        val updated = previous.copy(mealType = mealType, quantity = quantity)
        if (isSameDay(oldDate, newDate)) {
            cache.applyOptimisticUpsert(newDate, timezone, updated)
        } else {
            cache.applyOptimisticRemove(oldDate, timezone, previous.id)
            cache.applyOptimisticUpsert(newDate, timezone, updated)
        }
        viewModelScope.launch {
            repository.updateEntry(previous.id, mealType, quantity, newDate, timezone)
                .onSuccess { real -> cache.applyOptimisticUpsert(newDate, timezone, real) }
                .onFailure {
                    cache.applyOptimisticRemove(newDate, timezone, updated.id)
                    cache.applyOptimisticUpsert(oldDate, timezone, previous)
                }
        }
    }

    private fun isSameDay(a: Date, b: Date): Boolean {
        val calA = java.util.Calendar.getInstance().apply { time = a }
        val calB = java.util.Calendar.getInstance().apply { time = b }
        return calA.get(java.util.Calendar.YEAR) == calB.get(java.util.Calendar.YEAR) &&
            calA.get(java.util.Calendar.DAY_OF_YEAR) == calB.get(java.util.Calendar.DAY_OF_YEAR)
    }

    /** Removes an entry immediately (no undo): used by swipe-to-delete and the confirm-dialog entry editor. */
    fun deleteEntryOptimistic(entry: FoodEntry, date: Date, timezone: TimeZone = TimeZone.getDefault()) {
        cache.applyOptimisticRemove(date, timezone, entry.id)
        viewModelScope.launch {
            repository.deleteEntry(entry.id).onFailure {
                cache.refresh(date, timezone, force = true)
            }
        }
    }

    private fun isoNow(): String {
        val format = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
        format.timeZone = TimeZone.getTimeZone("UTC")
        return format.format(Date())
    }
}
