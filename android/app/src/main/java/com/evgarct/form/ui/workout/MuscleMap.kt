package com.evgarct.form.ui.workout

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp

/**
 * Our canonical muscle id -> region slug(s) of the body outline in [BodyMapData].
 * Muscles without a drawn region (hip flexors, serratus, abductors) simply stay unhighlighted;
 * they still appear in the text labels.
 */
internal fun bodySlugs(muscle: String): List<String> = when (muscle) {
    "chest" -> listOf("chest")
    "lats", "upper back" -> listOf("upper-back")
    "lower back" -> listOf("lower-back")
    "shoulders" -> listOf("deltoids")
    "biceps" -> listOf("biceps")
    "triceps" -> listOf("triceps")
    "forearms" -> listOf("forearm")
    "abs" -> listOf("abs")
    "obliques" -> listOf("obliques")
    "quads" -> listOf("quadriceps")
    "hamstrings" -> listOf("hamstring")
    "glutes" -> listOf("gluteal")
    "calves" -> listOf("calves")
    "adductors" -> listOf("adductors")
    "traps" -> listOf("trapezius")
    "neck" -> listOf("neck")
    else -> emptyList()
}

private class ParsedShape(val slug: String, val paths: List<Path>)

private fun parse(shapes: List<BodyShape>): List<ParsedShape> =
    shapes.map { shape -> ParsedShape(shape.slug, shape.paths.map { PathParser().parsePathString(it).toPath() }) }

// Parsing ~35 SVG outlines is cheap but pointless to repeat: do it once per process.
private val parsedFront: List<ParsedShape> by lazy { parse(BodyMapData.front) }
private val parsedBack: List<ParsedShape> by lazy { parse(BodyMapData.back) }

/**
 * Front and back view of the body with the worked muscles highlighted: primary muscles in the
 * theme's primary color, secondary ones in a lighter tint. Size it by height (e.g. `Modifier.height(88.dp)`).
 */
@Composable
fun MuscleMap(
    primary: List<String>,
    secondary: List<String>,
    modifier: Modifier = Modifier
) {
    val colorScheme = MaterialTheme.colorScheme
    val primarySlugs = remember(primary) { primary.flatMap(::bodySlugs).toSet() }
    val secondarySlugs = remember(secondary, primarySlugs) { secondary.flatMap(::bodySlugs).toSet() - primarySlugs }
    val neutral = colorScheme.onSurface.copy(alpha = 0.12f)
    val strong = colorScheme.primary
    val soft = colorScheme.primary.copy(alpha = 0.4f)

    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        BodyView(parsedFront, 0f, primarySlugs, secondarySlugs, neutral, strong, soft)
        BodyView(parsedBack, BodyMapData.BACK_OFFSET_X, primarySlugs, secondarySlugs, neutral, strong, soft)
    }
}

@Composable
private fun RowScope.BodyView(
    shapes: List<ParsedShape>,
    offsetX: Float,
    primary: Set<String>,
    secondary: Set<String>,
    neutral: Color,
    strong: Color,
    soft: Color
) {
    Canvas(Modifier.fillMaxHeight().aspectRatio(BodyMapData.VIEW_WIDTH / BodyMapData.VIEW_HEIGHT)) {
        val factor = size.width / BodyMapData.VIEW_WIDTH
        scale(factor, factor, pivot = Offset.Zero) {
            translate(left = -offsetX) {
                // Silhouette first, worked muscles on top so their edges are never covered.
                shapes.filter { it.slug !in primary && it.slug !in secondary }
                    .forEach { shape -> shape.paths.forEach { drawPath(it, neutral) } }
                shapes.filter { it.slug in secondary }
                    .forEach { shape -> shape.paths.forEach { drawPath(it, soft) } }
                shapes.filter { it.slug in primary }
                    .forEach { shape -> shape.paths.forEach { drawPath(it, strong) } }
            }
        }
    }
}
