package com.evgarct.form.core.preferences

import android.content.Context
import android.content.SharedPreferences
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@Serializable
data class StoredNutritionGoals(
    val calories: Double? = null,
    val protein: Double? = null,
    val fat: Double? = null,
    val carbohydrates: Double? = null
)

class AppPreferences(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("form_preferences", Context.MODE_PRIVATE)

    private val json = Json { ignoreUnknownKeys = true }

    var appLanguage: String
        get() = prefs.getString("app_language", "en") ?: "en"
        set(value) = prefs.edit().putString("app_language", value).apply()

    var reportLanguage: String
        get() = prefs.getString("report_language", "en") ?: "en"
        set(value) = prefs.edit().putString("report_language", value).apply()

    var stepGoal: Int
        get() = prefs.getInt("step_goal", 10000)
        set(value) = prefs.edit().putInt("step_goal", value).apply()

    var nutritionGoals: StoredNutritionGoals
        get() {
            val raw = prefs.getString("nutrition_goals", null) ?: return StoredNutritionGoals()
            return try {
                json.decodeFromString(raw)
            } catch (e: Exception) {
                StoredNutritionGoals()
            }
        }
        set(value) {
            prefs.edit().putString("nutrition_goals", json.encodeToString(value)).apply()
        }

    fun getCoverPhotoId(eventId: String): String? {
        return prefs.getString("cover_photo_$eventId", null)
    }

    fun setCoverPhotoId(eventId: String, photoId: String) {
        prefs.edit().putString("cover_photo_$eventId", photoId).apply()
    }
}
