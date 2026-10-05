package com.evgarct.form.ui.timeline

import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.Locale

class TimelineDatesTest {

    @Test
    fun usesTheEventsTimezoneNotUtcOrTheDevice() {
        // 22:30 UTC is already the next calendar day in Prague (UTC+2 in October).
        assertEquals("4 October 2026", formatEventDate("2026-10-03T22:30:00.000Z", "Europe/Prague", Locale.US))
        assertEquals("3 October 2026", formatEventDate("2026-10-03T22:30:00.000Z", "UTC", Locale.US))
    }

    @Test
    fun fallsBackToTheRawDateOnBadInput() {
        assertEquals("2026-10-03", formatEventDate("2026-10-03T22:30:00.000Z", "Mars/Olympus", Locale.US))
        assertEquals("not-a-date", formatEventDate("not-a-date", "UTC", Locale.US))
    }
}
