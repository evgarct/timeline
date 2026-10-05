package com.evgarct.form.ui.timeline

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Formats an event instant as a calendar date in the event's own timezone, so a workout logged at
 * 22:30 UTC in Europe/Prague shows the next day, matching the server's day bucketing.
 * Falls back to the raw date digits if the timestamp or zone cannot be parsed.
 */
internal fun formatEventDate(occurredAt: String, timezone: String, locale: Locale = Locale.getDefault()): String = try {
    DateTimeFormatter.ofPattern("d MMMM yyyy", locale).format(Instant.parse(occurredAt).atZone(ZoneId.of(timezone)))
} catch (e: Exception) {
    occurredAt.take(10)
}
