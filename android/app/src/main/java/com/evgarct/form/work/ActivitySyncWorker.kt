package com.evgarct.form.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.evgarct.form.FormApp
import com.evgarct.form.data.repository.ActivityDataState
import java.time.LocalDate
import java.time.ZoneId

/**
 * Runs ~once a day, computes the just-completed day's final Health Connect
 * activity, and syncs it to the server so step history survives independent of
 * the phone. Never throws — a permission revoke, missing Health Connect, or
 * transient network error should just skip/retry, not crash the app.
 */
class ActivitySyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            val yesterday = LocalDate.now(ZoneId.systemDefault()).minusDays(1)
            val app = FormApp.instance
            val prefs = app.appPreferences

            when (val state = app.healthConnectRepository.getActivityData(yesterday, prefs.stepGoal)) {
                is ActivityDataState.Value -> {
                    val result = app.activityRepository.submitDailySnapshot(yesterday, state)
                    if (result.isSuccess) Result.success() else Result.retry()
                }
                is ActivityDataState.Denied, is ActivityDataState.Unavailable -> Result.success()
                is ActivityDataState.Loading -> Result.success()
            }
        } catch (e: Exception) {
            Result.success()
        }
    }
}
