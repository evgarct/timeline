package com.evgarct.form.core.network

import android.content.Context
import android.content.SharedPreferences
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import java.util.concurrent.ConcurrentHashMap

class PersistentCookieJar(context: Context) : CookieJar {
    private val sharedPreferences: SharedPreferences =
        context.getSharedPreferences("form_cookies", Context.MODE_PRIVATE)

    // Key: domain, Value: map of cookieKey to Cookie
    private val cookieStore = ConcurrentHashMap<String, ConcurrentHashMap<String, Cookie>>()

    init {
        loadCookiesFromPreferences()
    }

    @Synchronized
    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val domain = url.host
        val domainCookies = cookieStore.getOrPut(domain) { ConcurrentHashMap() }
        var changed = false

        for (cookie in cookies) {
            val key = cookieKey(cookie)
            if (cookie.expiresAt < System.currentTimeMillis()) {
                if (domainCookies.remove(key) != null) changed = true
            } else {
                domainCookies[key] = cookie
                changed = true
            }
        }

        if (changed) {
            persistCookies(domain)
        }
    }

    @Synchronized
    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val now = System.currentTimeMillis()
        val matchingCookies = mutableListOf<Cookie>()
        val expiredCookies = mutableListOf<Cookie>()

        for ((domain, cookies) in cookieStore) {
            if (url.host.endsWith(domain)) {
                for (cookie in cookies.values) {
                    if (cookie.expiresAt < now) {
                        expiredCookies.add(cookie)
                    } else if (cookie.matches(url)) {
                        matchingCookies.add(cookie)
                    }
                }
            }
        }

        if (expiredCookies.isNotEmpty()) {
            for (cookie in expiredCookies) {
                cookieStore[cookie.domain]?.remove(cookieKey(cookie))
            }
            for (domain in expiredCookies.map { it.domain }.distinct()) {
                persistCookies(domain)
            }
        }

        return matchingCookies
    }

    fun clear() {
        cookieStore.clear()
        sharedPreferences.edit().clear().apply()
    }

    private fun cookieKey(cookie: Cookie): String {
        return "${cookie.name}@${cookie.domain}${cookie.path}"
    }

    private fun persistCookies(domain: String) {
        val domainCookies = cookieStore[domain] ?: return
        val serialized = domainCookies.values.mapNotNull { encodeCookie(it) }
        sharedPreferences.edit().putStringSet("domain_$domain", serialized.toSet()).apply()
    }

    private fun loadCookiesFromPreferences() {
        val allEntries = sharedPreferences.all
        for ((key, value) in allEntries) {
            if (key.startsWith("domain_") && value is Set<*>) {
                val domain = key.removePrefix("domain_")
                val domainCookies = ConcurrentHashMap<String, Cookie>()
                for (encoded in value) {
                    if (encoded is String) {
                        decodeCookie(encoded)?.let { cookie ->
                            if (cookie.expiresAt >= System.currentTimeMillis()) {
                                domainCookies[cookieKey(cookie)] = cookie
                            }
                        }
                    }
                }
                if (domainCookies.isNotEmpty()) {
                    cookieStore[domain] = domainCookies
                }
            }
        }
    }

    private fun encodeCookie(cookie: Cookie): String {
        return buildString {
            append(cookie.name).append("|")
            append(cookie.value).append("|")
            append(cookie.expiresAt).append("|")
            append(cookie.domain).append("|")
            append(cookie.path).append("|")
            append(if (cookie.secure) "1" else "0").append("|")
            append(if (cookie.httpOnly) "1" else "0").append("|")
            append(if (cookie.hostOnly) "1" else "0")
        }
    }

    private fun decodeCookie(encoded: String): Cookie? {
        val parts = encoded.split("|")
        if (parts.size < 8) return null
        return try {
            val builder = Cookie.Builder()
                .name(parts[0])
                .value(parts[1])
                .expiresAt(parts[2].toLong())
                .path(parts[4])

            val domain = parts[3]
            val hostOnly = parts[7] == "1"
            if (hostOnly) {
                builder.hostOnlyDomain(domain)
            } else {
                builder.domain(domain)
            }

            if (parts[5] == "1") builder.secure()
            if (parts[6] == "1") builder.httpOnly()

            builder.build()
        } catch (e: Exception) {
            null
        }
    }
}
