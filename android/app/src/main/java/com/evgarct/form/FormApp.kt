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
import com.evgarct.form.data.cache.ActivityCache
import com.evgarct.form.data.cache.NutritionCache
import com.evgarct.form.data.repository.ActivityRepository
import com.evgarct.form.data.repository.AuthRepository
import com.evgarct.form.data.repository.HealthConnectRepository
import com.evgarct.form.data.repository.NutritionRepository
import com.evgarct.form.data.repository.TimelineRepository
import com.evgarct.form.work.ActivitySyncWorker
import com.evgarct.form.work.NutritionSyncWorker
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

    val nutritionCache: NutritionCache by lazy { NutritionCache(nutritionRepository, appPreferences) }
    val activityCache: ActivityCache by lazy { ActivityCache(healthConnectRepository, appPreferences) }

    override fun onCreate() {
        super.onCreate()
        instance = this

        cookieJar = PersistentCookieJar(this)
        apiClient = ApiClient(baseUrl = "https://form.safronov.dev", cookieJar = cookieJar)
        appPreferences = AppPreferences(this)

        authRepository = AuthRepository(apiClient)
        timelineRepository = TimelineRepository(apiClient)
        healthConnectRepository = HealthConnectRepository(this)
        nutritionRepository = NutritionRepository(apiClient, healthConnectRepository, appPreferences)
        activityRepository = ActivityRepository(apiClient)

        scheduleActivitySync()
        scheduleNutritionSync()
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

    /**
     * Daily catch-up for the Health Connect nutrition sync: re-upserts recent food entries so
     * ones logged while the sync was off, offline, or a live write silently failed still land.
     * The worker itself no-ops if [AppPreferences.syncNutritionToHealthConnect] is off.
     */
    private fun scheduleNutritionSync() {
        val now = LocalDateTime.now()
        val nextRun = now.toLocalDate().plusDays(1).atTime(LocalTime.of(0, 10))
        val initialDelayMinutes = ChronoUnit.MINUTES.between(now, nextRun).coerceAtLeast(1)

        val request = PeriodicWorkRequestBuilder<NutritionSyncWorker>(24, TimeUnit.HOURS)
            .setInitialDelay(initialDelayMinutes, TimeUnit.MINUTES)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, WorkRequest.MIN_BACKOFF_MILLIS, TimeUnit.MILLISECONDS)
            .build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "nutrition-daily-sync",
            ExistingPeriodicWorkPolicy.KEEP,
            request
        )
    }

    companion object {
        lateinit var instance: FormApp
            private set
    }
}
