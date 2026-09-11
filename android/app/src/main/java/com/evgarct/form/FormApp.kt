package com.evgarct.form

import android.app.Application
import com.evgarct.form.core.network.ApiClient
import com.evgarct.form.core.network.PersistentCookieJar
import com.evgarct.form.core.preferences.AppPreferences
import com.evgarct.form.data.repository.AuthRepository
import com.evgarct.form.data.repository.HealthConnectRepository
import com.evgarct.form.data.repository.NutritionRepository
import com.evgarct.form.data.repository.TimelineRepository

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
    }

    companion object {
        lateinit var instance: FormApp
            private set
    }
}
