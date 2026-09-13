package com.evgarct.form

import android.app.Application
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkRequest
import com.evgarct.form.core.network.ApiClient
import com.evgarct.form.core.network.PersistentCookieJar
import com.evgarct.form.core.preferences.AppPreferences
import com.evgarct.form.data.repository.ActivityRepository
import com.evgarct.form.data.repository.AuthRepository
import com.evgarct.form.data.repository.HealthConnectRepository
import com.evgarct.form.data.repository.NutritionRepository
import com.evgarct.form.data.repository.TimelineRepository
import com.evgarct.form.work.ActivitySyncWorker
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.temporal.ChronoUnit
import java.util.concurrent.TimeUnit

class FormApp : Application() {

    lateinit var cookieJar: PersistentCookieJar
        private set
    lateinit var apiClient: ApiClient
        private set
    lateinit var appPreferences: AppPreferences
        private set
    lateinit var authRepository: AuthRepository
        private set
    lateinit var timelineRepository: TimelineRepository
        private set
    lateinit var nutritionRepository: NutritionRepository
        private set
    lateinit var healthConnectRepository: HealthConnectRepository
        private set
    lateinit var activityRepository: ActivityRepository
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        cookieJar = PersistentCookieJar(this)
        apiClient = ApiClient(baseUrl = "https://form.safronov.dev", cookieJar = cookieJar)
        appPreferences = AppPreferences(this)

        authRepository = AuthRepository(apiClient)
        timelineRepository = TimelineRepository(apiClient)
        nutritionRepository = NutritionRepository(apiClient)
        healthConnectRepository = HealthConnectRepository(this)
        activityRepository = ActivityRepository(apiClient)

        scheduleActivitySync()
    }

    private fun scheduleActivitySync() {
        val now = LocalDateTime.now()
        val nextRun = now.toLocalDate().plusDays(1).atTime(LocalTime.of(0, 10))
        val initialDelayMinutes = ChronoUnit.MINUTES.between(now, nextRun).coerceAtLeast(1)

        val request = PeriodicWorkRequestBuilder<ActivitySyncWorker>(24, TimeUnit.HOURS)
            .setInitialDelay(initialDelayMinutes, TimeUnit.MINUTES)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, WorkRequest.MIN_BACKOFF_MILLIS, TimeUnit.MILLISECONDS)
            .build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "activity-daily-sync",
            ExistingPeriodicWorkPolicy.KEEP,
            request
        )
    }

    companion object {
        lateinit var instance: FormApp
            private set
    }
}
