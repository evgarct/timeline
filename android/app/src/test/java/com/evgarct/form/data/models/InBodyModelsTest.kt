package com.evgarct.form.data.models

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Fabricated sheets: the backend JSON of an `inbody` event, with the fields the app now reads. */
class InBodyModelsTest {

    private val json = Json { ignoreUnknownKeys = true; isLenient = true; coerceInputValues = true }

    private fun event(id: String, occurredAt: String, weight: Double, extraMetrics: String = "", reviewed: Boolean = true) = """
        {
          "id": "$id", "type": "inbody", "occurredAt": "$occurredAt", "timezone": "Europe/Prague",
          "source": { "assetId": "5b7f2a40-1c8e-4d6a-9f3b-2e1d0c9b8a77", "mimeType": "image/jpeg", "fileName": "sheet.jpg", "url": "/api/media/x" },
          "report": { "device": "InBody270", "heightCm": 180 },
          "extraction": { "method": "mcp_agent", "reviewed": $reviewed },
          "metrics": [
            { "key": "inbody_score", "label": "InBody Score", "unit": "points", "category": "other", "value": 82 },
            { "key": "weight", "label": "Weight", "unit": "kg", "category": "composition", "value": $weight, "referenceMin": 60.2, "referenceMax": 81.4 },
            { "key": "percent_body_fat", "label": "Percent Body Fat", "unit": "%", "category": "obesity", "value": 13.4, "evaluation": "normal" }
            $extraMetrics
          ]
        }
    """.trimIndent()

    private fun decode(raw: String) = json.decodeFromString(TimelineEvent.serializer(), raw) as TimelineEvent.InBody

    @Test
    fun decodesTheFullSheetFields() {
        val segment = """,{ "key": "lean_mass_kg", "label": "Segmental Lean Mass", "unit": "kg", "category": "segmental_lean", "segment": "left_arm", "value": 3.7 },
            { "key": "impedance_ohm", "label": "Impedance", "unit": "Ω", "category": "impedance", "segment": "trunk", "frequencyKhz": 20, "value": 25.1 }"""
        val inbody = decode(event("a1", "2026-06-20T14:16:00.000Z", 76.1, segment))

        assertEquals("InBody270", inbody.device)
        assertTrue(inbody.reviewed)
        assertEquals("5b7f2a40-1c8e-4d6a-9f3b-2e1d0c9b8a77", inbody.source?.assetId)
        assertEquals("image/jpeg", inbody.source?.mimeType)
        val weight = inbody.metric("weight")!!
        assertEquals(60.2, weight.referenceMin!!, 0.001)
        assertEquals(81.4, weight.referenceMax!!, 0.001)
        assertEquals("normal", inbody.metric("percent_body_fat")?.evaluation)
        // the same key per segment / frequency is a different reading
        assertEquals(3.7, inbody.metric("lean_mass_kg", "left_arm")!!.value, 0.001)
        assertNull(inbody.metric("lean_mass_kg"))
        assertEquals(20.0, inbody.metric("impedance_ohm", "trunk", 20.0)!!.frequencyKhz!!, 0.001)
    }

    @Test
    fun anOlderEventWithoutTheNewFieldsStillDecodes() {
        val raw = """{ "id": "old", "type": "inbody", "occurredAt": "2024-03-07T08:48:00.000Z", "timezone": "UTC",
            "metrics": [ { "key": "weight", "label": "Weight", "value": 79.0, "category": "composition" } ] }"""
        val inbody = decode(raw)
        assertNull(inbody.source)
        assertNull(inbody.device)
        assertTrue(inbody.reviewed)
        assertEquals("", inbody.metric("weight")!!.displayUnit())
    }

    @Test
    fun anAgentEventIsNotReviewedUntilConfirmed() {
        assertFalse(decode(event("a2", "2026-06-20T14:16:00.000Z", 76.1, reviewed = false)).reviewed)
    }

    @Test
    fun changesSincePreviousTestAreRoundedAndMissingWhenAReadingIsAbsent() {
        val before = decode(event("b1", "2026-03-01T09:00:00.000Z", 75.0))
        val after = decode(event("b2", "2026-06-20T14:16:00.000Z", 76.1))
        assertEquals(1.1, after.delta(before, "weight")!!, 0.0001)
        assertEquals("+1.1".replace('.', ','), formatDelta(after.delta(before, "weight")).replace('.', ','))
        assertNull(after.delta(null, "weight"))
        assertNull(after.delta(before, "skeletal_muscle_mass"))
        assertEquals("", formatDelta(0.0))
        assertTrue(formatDelta(-0.4).startsWith("−"))
    }

    @Test
    fun testsAreOrderedOldestFirstAndEachKnowsItsPredecessor() {
        val newest = decode(event("c3", "2026-06-20T14:16:00.000Z", 78.0))
        val oldest = decode(event("c1", "2026-01-10T08:48:00.000Z", 79.0))
        val middle = decode(event("c2", "2026-03-01T09:00:00.000Z", 75.3))
        val ordered = listOf<TimelineEvent>(newest, oldest, middle).inBodyTestsOldestFirst()
        assertEquals(listOf("c1", "c2", "c3"), ordered.map { it.id })
        assertNull(ordered.previousOf(oldest))
        assertEquals("c2", ordered.previousOf(newest)?.id)
        assertNotNull(ordered.previousOf(middle))
    }

    @Test
    fun readingsDropAPointlessDecimalAndTheScoreUnit() {
        assertEquals("82", formatReading(82.0).replace(',', '.'))
        assertEquals("76.1", formatReading(76.1).replace(',', '.'))
        assertEquals("0.82", formatReading(0.82).replace(',', '.'))
        val score = decode(event("d1", "2026-06-20T14:16:00.000Z", 76.1)).metric("inbody_score")!!
        assertEquals("", score.displayUnit())
    }

    @Test
    fun decodesTheContextBetweenTests() {
        val raw = """{ "tests": [ { "id": "t1", "date": "2026-06-20",
            "interval": { "fromDate": "2026-03-01", "toDate": "2026-06-20", "days": 111,
              "nutrition": { "loggedDays": 80, "avgKcal": 2350.5, "avgProteinG": 160 },
              "steps": { "days": 90, "avgSteps": 8200 },
              "workouts": { "count": 40, "setCount": 800, "tonnageKg": 120000 } },
            "photos": [ { "eventId": "p1", "date": "2026-05-01", "daysFromTest": -50 } ],
            "measurement": { "eventId": "m1", "date": "2026-06-15", "daysFromTest": -5, "values": { "waistCm": 80.0 } },
            "someFutureField": true } ] }"""
        val test = json.decodeFromString(BodyTestsResponse.serializer(), raw).tests.single()
        val interval = test.interval ?: error("interval missing")
        val nutrition = interval.nutrition ?: error("nutrition missing")
        assertEquals(111, interval.days)
        assertEquals(80, nutrition.loggedDays)
        assertNull(nutrition.avgFatG)
        assertEquals(8200, interval.steps?.avgSteps)
        assertEquals(40, interval.workouts.count)
        assertEquals(-50, test.photos.single().daysFromTest)
        assertEquals(80.0, test.measurement!!.values.getValue("waistCm"), 0.001)
    }
}
