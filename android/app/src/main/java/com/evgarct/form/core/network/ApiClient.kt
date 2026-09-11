package com.evgarct.form.core.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit

class SessionExpiredException : IOException("Session expired or unauthorized")
class ApiException(val code: Int, message: String) : IOException("API Error $code: $message")

class ApiClient(
    val baseUrl: String = "https://form.safronov.dev",
    val cookieJar: PersistentCookieJar
) {
    val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
        coerceInputValues = true
    }

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    val okHttpClient: OkHttpClient = OkHttpClient.Builder()
        .cookieJar(cookieJar)
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()

    suspend fun get(path: String, queryParams: Map<String, String> = emptyMap()): String = withContext(Dispatchers.IO) {
        val urlBuilder = (baseUrl.trimEnd('/') + "/" + path.trimStart('/')).let { url ->
            val builder = url.toHttpUrlOrNull()?.newBuilder()
                ?: throw IllegalArgumentException("Invalid URL: $url")
            for ((key, value) in queryParams) {
                builder.addQueryParameter(key, value)
            }
            builder.build()
        }

        val request = Request.Builder()
            .url(urlBuilder)
            .get()
            .build()

        executeRequest(request)
    }

    suspend fun postJson(path: String, jsonBody: String): String = withContext(Dispatchers.IO) {
        val url = baseUrl.trimEnd('/') + "/" + path.trimStart('/')
        val body = jsonBody.toRequestBody(jsonMediaType)
        val request = Request.Builder()
            .url(url)
            .post(body)
            .build()

        executeRequest(request)
    }

    suspend fun putJson(path: String, jsonBody: String): String = withContext(Dispatchers.IO) {
        val url = baseUrl.trimEnd('/') + "/" + path.trimStart('/')
        val body = jsonBody.toRequestBody(jsonMediaType)
        val request = Request.Builder()
            .url(url)
            .put(body)
            .build()

        executeRequest(request)
    }

    suspend fun delete(path: String): String = withContext(Dispatchers.IO) {
        val url = baseUrl.trimEnd('/') + "/" + path.trimStart('/')
        val request = Request.Builder()
            .url(url)
            .delete()
            .build()

        executeRequest(request)
    }

    suspend fun postMultipart(path: String, requestBody: RequestBody): String = withContext(Dispatchers.IO) {
        val url = baseUrl.trimEnd('/') + "/" + path.trimStart('/')
        val request = Request.Builder()
            .url(url)
            .post(requestBody)
            .build()

        executeRequest(request)
    }

    private fun executeRequest(request: Request): String {
        val response: Response = okHttpClient.newCall(request).execute()
        response.use { res ->
            if (res.code == 401) {
                throw SessionExpiredException()
            }
            val responseBody = res.body?.string() ?: ""
            if (!res.isSuccessful) {
                throw ApiException(res.code, responseBody)
            }
            return responseBody
        }
    }
}
