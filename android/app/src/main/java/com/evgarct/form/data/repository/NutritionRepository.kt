package com.evgarct.form.data.repository

import android.util.Log
import com.evgarct.form.core.network.ApiClient
import com.evgarct.form.core.preferences.AppPreferences
import com.evgarct.form.data.models.FoodEntry
import com.evgarct.form.data.models.FoodQuantity
import com.evgarct.form.data.models.MealType
import com.evgarct.form.data.models.NutrientValue
import com.evgarct.form.data.models.NutritionProduct
import com.evgarct.form.data.models.ProductSearchPage
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

@Serializable
data class ReportUploadResponse(
    val reportId: String,
    val shareUrl: String
)

class NutritionRepository(
    private val apiClient: ApiClient,
    private val healthConnectRepository: HealthConnectRepository,
    private val appPreferences: AppPreferences
) {

    private fun dateFormatter(timezone: TimeZone): SimpleDateFormat {
        return SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
            timeZone = timezone
        }
    }

    /**
     * Best-effort push of a food entry into Health Connect's NutritionRecord store. Never
     * surfaces failures to callers — an HC write failure must not flip a successful backend
     * write into an error the UI reports to the user.
     */
    private suspend fun syncToHealthConnect(entry: FoodEntry) {
        if (!appPreferences.syncNutritionToHealthConnect) return
        try {
            if (!healthConnectRepository.hasNutritionWritePermission()) return
            healthConnectRepository.upsertNutritionRecord(entry)
        } catch (e: Exception) {
            Log.d("NutritionRepository", "Health Connect sync failed for entry ${entry.id}", e)
        }
    }

    private suspend fun deleteFromHealthConnect(entryId: String) {
        if (!appPreferences.syncNutritionToHealthConnect) return
        try {
            if (!healthConnectRepository.hasNutritionWritePermission()) return
            healthConnectRepository.deleteNutritionRecord(entryId)
        } catch (e: Exception) {
            Log.d("NutritionRepository", "Health Connect delete failed for entry $entryId", e)
        }
    }

    suspend fun getEntries(date: Date, timezone: TimeZone): Result<List<FoodEntry>> = runCatching {
        val dateStr = dateFormatter(timezone).format(date)
        val params = mapOf("date" to dateStr, "timezone" to timezone.id)
        val jsonStr = apiClient.get("api/nutrition/entries", params)
        apiClient.json.decodeFromString(ListSerializer(FoodEntry.serializer()), jsonStr)
    }

    suspend fun recordEntry(
        productId: String?,
        mealType: MealType,
        quantity: FoodQuantity,
        date: Date,
        timezone: TimeZone,
        note: String? = null
    ): Result<FoodEntry> = runCatching {
        val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val quantityElement = apiClient.json.encodeToJsonElement(FoodQuantity.serializer(), quantity)
        val mealTypeStr = when (mealType) {
            MealType.BREAKFAST -> "breakfast"
            MealType.LUNCH -> "lunch"
            MealType.DINNER -> "dinner"
            MealType.SNACK -> "snack"
        }

        val body = buildJsonObject {
            productId?.let { put("productId", it) }
            put("mealType", mealTypeStr)
            put("quantity", quantityElement)
            put("occurredAt", isoFormat.format(date))
            put("timezone", timezone.id)
            note?.let { put("note", it) }
            put("idempotencyKey", UUID.randomUUID().toString().lowercase())
        }.toString()

        val jsonStr = apiClient.postJson("api/nutrition/entries", body)
        val entry = apiClient.json.decodeFromString(FoodEntry.serializer(), jsonStr)
        syncToHealthConnect(entry)
        entry
    }

    suspend fun updateEntry(
        entryId: String,
        mealType: MealType,
        quantity: FoodQuantity,
        date: Date,
        timezone: TimeZone
    ): Result<FoodEntry> = runCatching {
        val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val quantityElement = apiClient.json.encodeToJsonElement(FoodQuantity.serializer(), quantity)
        val mealTypeStr = when (mealType) {
            MealType.BREAKFAST -> "breakfast"
            MealType.LUNCH -> "lunch"
            MealType.DINNER -> "dinner"
            MealType.SNACK -> "snack"
        }

        val body = buildJsonObject {
            put("mealType", mealTypeStr)
            put("quantity", quantityElement)
            put("occurredAt", isoFormat.format(date))
            put("timezone", timezone.id)
        }.toString()

        val jsonStr = apiClient.putJson("api/nutrition/entries/$entryId", body)
        val entry = apiClient.json.decodeFromString(FoodEntry.serializer(), jsonStr)
        syncToHealthConnect(entry)
        entry
    }

    suspend fun deleteEntry(entryId: String): Result<Unit> = runCatching {
        apiClient.delete("api/nutrition/entries/$entryId")
        deleteFromHealthConnect(entryId)
    }

    suspend fun repeatMeal(
        mealType: MealType,
        sourceDate: Date,
        targetDate: Date,
        timezone: TimeZone
    ): Result<List<FoodEntry>> = runCatching {
        val df = dateFormatter(timezone)
        val mealTypeStr = when (mealType) {
            MealType.BREAKFAST -> "breakfast"
            MealType.LUNCH -> "lunch"
            MealType.DINNER -> "dinner"
            MealType.SNACK -> "snack"
        }

        val body = buildJsonObject {
            put("mealType", mealTypeStr)
            put("sourceDate", df.format(sourceDate))
            put("targetDate", df.format(targetDate))
            put("timezone", timezone.id)
        }.toString()

        val jsonStr = apiClient.postJson("api/nutrition/entries/repeat", body)
        apiClient.json.decodeFromString(ListSerializer(FoodEntry.serializer()), jsonStr)
    }

    suspend fun searchProducts(query: String, page: Int = 1, pageSize: Int = 30): Result<ProductSearchPage> = runCatching {
        val params = mapOf("query" to query, "page" to page.toString(), "pageSize" to pageSize.toString())
        val jsonStr = apiClient.get("api/nutrition/products", params)
        apiClient.json.decodeFromString(ProductSearchPage.serializer(), jsonStr)
    }

    suspend fun recentProducts(mealType: MealType? = null, page: Int = 1, pageSize: Int = 20): Result<ProductSearchPage> = runCatching {
        val endpoint = if (mealType != null) "api/nutrition/products/recent" else "api/nutrition/products"
        val mealTypeStr = mealType?.name?.lowercase() ?: ""
        val params = if (mealType != null) {
            mapOf("mealType" to mealTypeStr, "page" to page.toString(), "pageSize" to pageSize.toString())
        } else {
            mapOf("query" to "", "page" to page.toString(), "pageSize" to pageSize.toString())
        }
        val jsonStr = apiClient.get(endpoint, params)
        apiClient.json.decodeFromString(ProductSearchPage.serializer(), jsonStr)
    }

    suspend fun getNutrients(date: Date, timezone: TimeZone): Result<List<NutrientValue>> = runCatching {
        val dateStr = dateFormatter(timezone).format(date)
        val params = mapOf("date" to dateStr, "timezone" to timezone.id)
        val jsonStr = apiClient.get("api/nutrition/nutrients", params)
        apiClient.json.decodeFromString(ListSerializer(NutrientValue.serializer()), jsonStr)
    }

    suspend fun submitReport(
        pdfBytes: ByteArray,
        ogImageBytes: ByteArray,
        reportDate: Date,
        timezone: TimeZone
    ): Result<String> = runCatching {
        val dateStr = dateFormatter(timezone).format(reportDate)
        val boundary = "Boundary-${UUID.randomUUID()}"
        val multipartBody = MultipartBody.Builder(boundary)
            .setType(MultipartBody.FORM)
            .addFormDataPart("reportDate", dateStr)
            .addFormDataPart("timezone", timezone.id)
            .addFormDataPart("pdf", "report.pdf", pdfBytes.toRequestBody("application/pdf".toMediaType()))
            .addFormDataPart("ogImage", "og.jpg", ogImageBytes.toRequestBody("image/jpeg".toMediaType()))
            .build()

        val jsonStr = apiClient.postMultipart("api/nutrition/reports", multipartBody)
        val response = apiClient.json.decodeFromString(ReportUploadResponse.serializer(), jsonStr)
        response.shareUrl
    }
}
