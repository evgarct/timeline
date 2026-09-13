package com.evgarct.form.data.cache

import com.evgarct.form.data.repository.ActivityDataState
import com.evgarct.form.data.repository.HealthConnectRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.time.LocalDate

/**
 * In-memory stale-while-revalidate cache mirroring [NutritionCache], so the Today
 * screen's activity column doesn't flash back to zero/Loading on every tab switch
 * while nutrition already shows last-known data.
 */
class ActivityCache(private val repository: HealthConnectRepository) {

    data class DayState(
        val data: ActivityDataState = ActivityDataState.Loading,
        val isLoading: Boolean = false,
        val lastFetchedAt: Long? = null
    )

    private val _state = MutableStateFlow<Map<String, DayState>>(emptyMap())
    val state: StateFlow<Map<String, DayState>> = _state.asStateFlow()

    private fun key(date: LocalDate, goal: Int): String = "$date|$goal"

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
    }

    fun invalidate(date: LocalDate, goal: Int) {
        _state.update { it - key(date, goal) }
    }
}
