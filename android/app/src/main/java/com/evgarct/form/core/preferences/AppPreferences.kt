package com.evgarct.form.core.preferences

import android.content.Context
import android.content.SharedPreferences
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.evgarct.form.core.theme.ThemeMode
import com.evgarct.form.data.models.FoodEntry
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
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

    /** Compose-observable so `FormTheme` (above any ViewModel) recomposes when this changes. */
    var themeMode: ThemeMode by mutableStateOf(ThemeMode.fromKey(prefs.getString("theme_mode", null)))
        private set

    fun updateThemeMode(mode: ThemeMode) {
        themeMode = mode
        prefs.edit().putString("theme_mode", mode.key).apply()
    }

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

    /**
     * Last-known nutrition entries for a given day key (yyyy-MM-dd), so cold app starts can
     * render real data immediately instead of zeros while a fresh fetch runs in the background.
     */
    fun getCachedEntries(dateKey: String): List<FoodEntry>? {
        if (prefs.getString("cached_entries_date", null) != dateKey) return null
        val raw = prefs.getString("cached_entries_json", null) ?: return null
        return try {
            json.decodeFromString(ListSerializer(FoodEntry.serializer()), raw)
        } catch (e: Exception) {
            null
        }
    }

    fun setCachedEntries(dateKey: String, entries: List<FoodEntry>) {
        prefs.edit()
            .putString("cached_entries_date", dateKey)
            .putString("cached_entries_json", json.encodeToString(ListSerializer(FoodEntry.serializer()), entries))
            .apply()
    }

    /** Last-known step count/goal for a given day key, for the same cold-start reason as above. */
    fun getCachedSteps(dateKey: String): Pair<Long, Int>? {
        if (prefs.getString("cached_steps_date", null) != dateKey) return null
        val steps = prefs.getLong("cached_steps_value", -1L)
        val goal = prefs.getInt("cached_steps_goal", -1)
        if (steps < 0 || goal < 0) return null
        return steps to goal
    }

    fun setCachedSteps(dateKey: String, steps: Long, goal: Int) {
        prefs.edit()
            .putString("cached_steps_date", dateKey)
            .putLong("cached_steps_value", steps)
            .putInt("cached_steps_goal", goal)
            .apply()
    }

    fun getCoverPhotoId(eventId: String): String? {
        return prefs.getString("cover_photo_$eventId", null)
    }

    fun setCoverPhotoId(eventId: String, photoId: String) {
        prefs.edit().putString("cover_photo_$eventId", photoId).apply()
    }
}
