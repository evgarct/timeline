package com.evgarct.form.data.repository

import com.evgarct.form.core.network.ApiClient
import com.evgarct.form.core.network.SessionExpiredException
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

sealed class AuthResult {
    object Success : AuthResult()
    data class Error(val message: String) : AuthResult()
}

class AuthRepository(private val apiClient: ApiClient) {

    suspend fun requestOtp(email: String): Result<Unit> = runCatching {
        if (!email.contains("@")) {
            throw IllegalArgumentException("Invalid email address")
        }
        val payload = buildJsonObject {
            put("email", email.trim())
            put("type", "sign-in")
        }.toString()

        apiClient.postJson("api/auth/email-otp/send-verification-otp", payload)
    }

    suspend fun verifyOtp(email: String, otp: String): Result<Unit> = runCatching {
        if (otp.length < 4) {
            throw IllegalArgumentException("Code too short")
        }
        val payload = buildJsonObject {
            put("email", email.trim())
            put("otp", otp.trim())
        }.toString()

        apiClient.postJson("api/auth/sign-in/email-otp", payload)
        val hasSession = hasSession()
        if (!hasSession) {
            throw IllegalStateException("Session not established after verification")
        }
    }

    suspend fun hasSession(): Boolean {
        return try {
            val response = apiClient.get("api/auth/get-session")
            response.isNotBlank() && response.trim() != "null"
        } catch (e: SessionExpiredException) {
            false
        } catch (e: Exception) {
            false
        }
    }

    suspend fun signOut(): Result<Unit> = runCatching {
        try {
            apiClient.postJson("api/auth/sign-out", "{}")
        } finally {
            apiClient.cookieJar.clear()
        }
    }
}
