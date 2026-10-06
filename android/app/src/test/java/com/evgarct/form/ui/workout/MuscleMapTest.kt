package com.evgarct.form.ui.workout

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MuscleMapTest {

    private val canonicalMuscles = listOf(
        "chest", "lats", "upper back", "lower back", "shoulders", "biceps", "triceps", "forearms", "abs",
        "obliques", "quads", "hamstrings", "glutes", "calves", "adductors", "traps", "neck"
    )

    @Test
    fun everyDrawableMuscleMapsToARegionThatExistsInTheBodyOutline() {
        val known = (BodyMapData.front + BodyMapData.back).map { it.slug }.toSet()
        canonicalMuscles.forEach { muscle ->
            val slugs = bodySlugs(muscle)
            assertTrue("$muscle has no region", slugs.isNotEmpty())
            slugs.forEach { assertTrue("$muscle -> $it is not in the outline", it in known) }
        }
    }

    @Test
    fun musclesWithoutARegionAreSkippedInsteadOfCrashing() {
        assertEquals(emptyList<String>(), bodySlugs("hip flexors"))
        assertEquals(emptyList<String>(), bodySlugs("serratus"))
        assertEquals(emptyList<String>(), bodySlugs("something custom"))
    }

    @Test
    fun theGeneratedOutlineHasBothViewsAndWellFormedPaths() {
        assertTrue(BodyMapData.front.size >= 15)
        assertTrue(BodyMapData.back.size >= 12)
        (BodyMapData.front + BodyMapData.back).forEach { shape ->
            assertTrue("${shape.slug} has no paths", shape.paths.isNotEmpty())
            shape.paths.forEach { assertTrue(it.startsWith("M") || it.startsWith("m")) }
        }
    }
}
