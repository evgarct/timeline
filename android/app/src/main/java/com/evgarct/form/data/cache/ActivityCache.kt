package com.evgarct.form.data.cache

import com.evgarct.form.core.preferences.AppPreferences
import com.evgarct.form.data.repository.ActivityDataState
import com.evgarct.form.data.repository.HealthConnectRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.time.LocalDate

/**
 * Stale-while-revalidate cache mirroring [NutritionCache], so the Today screen's
 * activity column doesn't flash back to zero/Loading on every tab switch or cold
 * start while nutrition already shows last-known data. Seeds today's step count
 * from [AppPreferences] on construction for the same reason.
 */
class ActivityCache(
    private val repository: HealthConnectRepository,
    private val preferences: AppPreferences
) {

    data class DayState(
        val data: ActivityDataState = ActivityDataState.Loading,
        val isLoading: Boolean = false,
        val lastFetchedAt: Long? = null
    )

    private val _state = MutableStateFlow<Map<String, DayState>>(emptyMap())
    val state: StateFlow<Map<String, DayState>> = _state.asStateFlow()

    private fun key(date: LocalDate, goal: Int): String = "$date|$goal"

    init {
        val today = LocalDate.now()
        preferences.getCachedSteps(today.toString())?.let { (steps, goal) ->
            _state.update {
                it + (key(today, goal) to DayState(data = ActivityDataState.Value(steps, goal, null, 0, emptyList())))
            }
        }
    }

    fun stateFor(date: LocalDate, goal: Int): DayState = _state.value[key(date, goal)] ?: DayState()

    suspend fun refresh(date: LocalDate, goal: Int, force: Boolean = false, ttlMillis: Long = 60_000) {
        val k = key(date, goal)
        val current = _state.value[k]
        val isFresh = current?.lastFetchedAt?.let { System.currentTimeMillis() - it < ttlMillis } == true
        if (isFresh && !force) return

        _state.update { it + (k to (it[k] ?: DayState()).copy(isLoading = true)) }
        val result = repository.getActivityData(date, goal)
        _state.update {
            it + (k to DayState(data = result, isLoading = false, lastFetchedAt = System.currentTimeMillis()))
        }
        if (date == LocalDate.now() && result is ActivityDataState.Value) {
            preferences.setCachedSteps(date.toString(), result.steps, goal)
        }
    }

    fun invalidate(date: LocalDate, goal: Int) {
        _state.update { it - key(date, goal) }
    }
}
