package com.evgarct.form.work

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.evgarct.form.FormApp
import java.time.LocalDate
import java.time.ZoneId
import java.util.Calendar
import java.util.TimeZone

/**
 * Runs ~once a day (and once per app foreground, see [com.evgarct.form.MainActivity.onStart]) and
 * reconciles the last few days of food entries with Health Connect. This is a catch-up for
 * entries created, edited, or deleted outside the app's own live sync — most notably via the MCP
 * nutrition tools, which write straight to the backend and never touch
 * [com.evgarct.form.data.repository.NutritionRepository]'s in-app sync calls. For each day: every
 * current backend entry is upserted (idempotent via Health Connect's clientRecordId, so
 * re-writing unchanged entries is safe), then Health Connect is read back for that day and any
 * record Form previously wrote but that no longer exists in the backend is deleted — Health
 * Connect itself is the source of truth for "what Form has already written," so this reconciles
 * correctly even after a reinstall, with no separate local bookkeeping to go stale. Never throws —
 * a permission revoke, missing Health Connect, or transient network error should just skip/retry,
 * not crash the app.
 */
class NutritionSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    private companion object {
        const val TAG = "NutritionSyncWorker"
        const val BACKFILL_DAYS = 3
    }

    override suspend fun doWork(): Result {
        return try {
            val app = FormApp.instance
            val prefs = app.appPreferences
            if (!prefs.syncNutritionToHealthConnect) return Result.success()
            if (!app.healthConnectRepository.hasNutritionWritePermission()) return Result.success()

            val zoneId = ZoneId.systemDefault()
            val timezone = TimeZone.getDefault()
            var anyFailure = false

            for (dayOffset in 0 until BACKFILL_DAYS) {
                val day = LocalDate.now(zoneId).minusDays(dayOffset.toLong())
                val date = Calendar.getInstance(timezone).apply {
                    set(day.year, day.monthValue - 1, day.dayOfMonth, 0, 0, 0)
                    set(Calendar.MILLISECOND, 0)
                }.time

                val entries = app.nutritionRepository.getEntries(date, timezone).getOrNull() ?: continue
                val currentIds = entries.map { it.id }.toSet()
                for (entry in entries) {
                    val result = app.healthConnectRepository.upsertNutritionRecord(entry)
                    if (result.isFailure) anyFailure = true
                }

                // Reconcile deletions that happened outside the app (e.g. via MCP): anything
                // Health Connect still has for this day that the backend no longer has gets
                // removed. Only runs when the read-back itself succeeds — an empty result from a
                // failed read must never be mistaken for "nothing exists" and mass-delete.
                val startOfDay = day.atStartOfDay(zoneId).toInstant()
                val endOfDay = day.plusDays(1).atStartOfDay(zoneId).toInstant()
                val existingIds = app.healthConnectRepository
                    .readOwnNutritionClientRecordIds(startOfDay, endOfDay)
                    .getOrNull()
                if (existingIds != null) {
                    for (staleId in existingIds - currentIds) {
                        val result = app.healthConnectRepository.deleteNutritionRecord(staleId)
                        if (result.isFailure) anyFailure = true
                    }
                }
            }

            if (anyFailure) {
                Log.w(TAG, "One or more entries failed to upsert into Health Connect; will retry")
                Result.retry()
            } else {
                Result.success()
            }
        } catch (e: Exception) {
            Log.w(TAG, "doWork failed unexpectedly", e)
            Result.success()
        }
    }
}
