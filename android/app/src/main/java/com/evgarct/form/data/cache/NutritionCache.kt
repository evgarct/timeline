package com.evgarct.form.data.cache

import com.evgarct.form.core.preferences.AppPreferences
import com.evgarct.form.data.models.FoodEntry
import com.evgarct.form.data.repository.NutritionRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Stale-while-revalidate cache for a day's food entries, shared by every screen that
 * reads nutrition data (Today, Nutrition) so a mutation made anywhere is visible
 * everywhere without a separate refresh signal. Seeds itself from [AppPreferences] so
 * a cold app start (fresh process — the common case after Android reclaims memory in
 * the background) shows real last-known data instead of zeros.
 */
class NutritionCache(
    private val repository: NutritionRepository,
    private val preferences: AppPreferences
) {

    data class DayState(
        val entries: List<FoodEntry> = emptyList(),
        val isLoading: Boolean = false,
        val lastFetchedAt: Long? = null,
        val error: Throwable? = null
    )

    private val _state = MutableStateFlow<Map<String, DayState>>(emptyMap())
    val state: StateFlow<Map<String, DayState>> = _state.asStateFlow()

    private val keyFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    private fun dayKeyOnly(date: Date, timezone: TimeZone): String {
        val formatter = keyFormat.clone() as SimpleDateFormat
        formatter.timeZone = timezone
        return formatter.format(date)
    }

    private fun key(date: Date, timezone: TimeZone): String = "${dayKeyOnly(date, timezone)}|${timezone.id}"

    init {
        val today = dayKeyOnly(Date(), TimeZone.getDefault())
        preferences.getCachedEntries(today)?.let { cached ->
            _state.update { it + (key(Date(), TimeZone.getDefault()) to DayState(entries = cached)) }
        }
    }

    fun stateFor(date: Date, timezone: TimeZone = TimeZone.getDefault()): DayState =
        _state.value[key(date, timezone)] ?: DayState()

    suspend fun refresh(date: Date, timezone: TimeZone = TimeZone.getDefault(), force: Boolean = false, ttlMillis: Long = 60_000) {
        val k = key(date, timezone)
        val current = _state.value[k]
        val isFresh = current?.lastFetchedAt?.let { System.currentTimeMillis() - it < ttlMillis } == true
        if (isFresh && !force) return

        _state.update { it + (k to (it[k] ?: DayState()).copy(isLoading = true)) }
        repository.getEntries(date, timezone)
            .onSuccess { entries ->
                _state.update {
                    it + (k to DayState(entries = entries, isLoading = false, lastFetchedAt = System.currentTimeMillis()))
                }
                if (dayKeyOnly(date, timezone) == dayKeyOnly(Date(), TimeZone.getDefault())) {
                    preferences.setCachedEntries(dayKeyOnly(date, timezone), entries)
                }
            }
            .onFailure { e ->
                _state.update { it + (k to (it[k] ?: DayState()).copy(isLoading = false, error = e)) }
            }
    }

    fun applyOptimisticUpsert(date: Date, timezone: TimeZone, entry: FoodEntry) {
        val k = key(date, timezone)
        _state.update { map ->
            val current = map[k] ?: DayState()
            val exists = current.entries.any { it.id == entry.id }
            val newEntries = if (exists) {
                current.entries.map { if (it.id == entry.id) entry else it }
            } else {
                current.entries + entry
            }
            map + (k to current.copy(entries = newEntries))
        }
    }

    fun replaceOptimistic(date: Date, timezone: TimeZone, tempId: String, real: FoodEntry) {
        val k = key(date, timezone)
        _state.update { map ->
            val current = map[k] ?: return@update map
            map + (k to current.copy(entries = current.entries.map { if (it.id == tempId) real else it }))
        }
    }

    fun applyOptimisticRemove(date: Date, timezone: TimeZone, entryId: String) {
        val k = key(date, timezone)
        _state.update { map ->
            val current = map[k] ?: return@update map
            map + (k to current.copy(entries = current.entries.filterNot { it.id == entryId }))
        }
    }

    fun applyOptimisticRestore(date: Date, timezone: TimeZone, entry: FoodEntry, index: Int) {
        val k = key(date, timezone)
        _state.update { map ->
            val current = map[k] ?: DayState()
            val newEntries = current.entries.toMutableList().apply {
                add(index.coerceIn(0, size), entry)
            }
            map + (k to current.copy(entries = newEntries))
        }
    }

    fun invalidate(date: Date, timezone: TimeZone = TimeZone.getDefault()) {
        val k = key(date, timezone)
        _state.update { it - k }
    }
}
