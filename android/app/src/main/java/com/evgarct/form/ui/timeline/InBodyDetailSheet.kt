package com.evgarct.form.ui.timeline

import android.content.ActivityNotFoundException
import android.content.Intent
import android.widget.Toast
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import com.evgarct.form.FormApp
import com.evgarct.form.R
import com.evgarct.form.core.theme.Ink
import com.evgarct.form.core.theme.SurfaceCard
import com.evgarct.form.core.theme.SurfaceCardBorder
import com.evgarct.form.core.theme.TextMuted
import com.evgarct.form.core.theme.TextPrimary
import com.evgarct.form.core.theme.TextSecondary
import com.evgarct.form.core.theme.Trace
import com.evgarct.form.data.models.BodyTest
import com.evgarct.form.data.models.INBODY_HEADLINE_KEYS
import com.evgarct.form.data.models.INBODY_PLAIN_SECTIONS
import com.evgarct.form.data.models.INBODY_SEGMENTS
import com.evgarct.form.data.models.INBODY_TREND_KEYS
import com.evgarct.form.data.models.InBodyMetric
import com.evgarct.form.data.models.TimelineEvent
import com.evgarct.form.data.models.delta
import com.evgarct.form.data.models.displayUnit
import com.evgarct.form.data.models.formatDelta
import com.evgarct.form.data.models.formatReading
import com.evgarct.form.data.models.metric
import com.evgarct.form.data.models.previousOf
import kotlinx.coroutines.launch

@Composable
fun inBodyMetricLabel(metric: InBodyMetric): String {
    val res = when (metric.key) {
        "inbody_score" -> R.string.inbody_metric_inbody_score
        "total_body_water" -> R.string.inbody_metric_total_body_water
        "protein" -> R.string.inbody_metric_protein
        "minerals" -> R.string.inbody_metric_minerals
        "body_fat_mass" -> R.string.inbody_metric_body_fat_mass
        "weight" -> R.string.inbody_metric_weight
        "skeletal_muscle_mass" -> R.string.inbody_metric_skeletal_muscle_mass
        "bmi" -> R.string.inbody_metric_bmi
        "percent_body_fat" -> R.string.inbody_metric_percent_body_fat
        "waist_hip_ratio" -> R.string.inbody_metric_waist_hip_ratio
        "visceral_fat_level" -> R.string.inbody_metric_visceral_fat_level
        "target_weight" -> R.string.inbody_metric_target_weight
        "weight_control" -> R.string.inbody_metric_weight_control
        "fat_control" -> R.string.inbody_metric_fat_control
        "muscle_control" -> R.string.inbody_metric_muscle_control
        "fat_free_mass" -> R.string.inbody_metric_fat_free_mass
        "basal_metabolic_rate" -> R.string.inbody_metric_basal_metabolic_rate
        "obesity_degree" -> R.string.inbody_metric_obesity_degree
        "smi" -> R.string.inbody_metric_smi
        "recommended_calorie_intake" -> R.string.inbody_metric_recommended_calorie_intake
        else -> null
    }
    // Readings without a translation (an unknown key, the calorie table) keep the label the backend stored.
    return if (res != null) stringResource(res) else metric.label
}

@Composable
private fun sectionTitle(category: String): String = stringResource(
    when (category) {
        "composition" -> R.string.inbody_section_composition
        "obesity" -> R.string.inbody_section_obesity
        "control" -> R.string.inbody_section_control
        "research" -> R.string.inbody_section_research
        "segmental_lean" -> R.string.inbody_section_segmental_lean
        "segmental_fat" -> R.string.inbody_section_segmental_fat
        "exercise" -> R.string.inbody_section_exercise
        else -> R.string.inbody_section_impedance
    }
)

@Composable
private fun segmentTitle(segment: String): String = stringResource(
    when (segment) {
        "left_arm" -> R.string.inbody_segment_left_arm
        "right_arm" -> R.string.inbody_segment_right_arm
        "trunk" -> R.string.inbody_segment_trunk
        "left_leg" -> R.string.inbody_segment_left_leg
        else -> R.string.inbody_segment_right_leg
    }
)

@Composable
private fun evaluationTitle(evaluation: String): String = stringResource(
    when (evaluation) {
        "under" -> R.string.inbody_eval_under
        "over" -> R.string.inbody_eval_over
        else -> R.string.inbody_eval_normal
    }
)

/** The normal range printed on the sheet as a band, with the reading as a dot. */
@Composable
private fun ReferenceBar(metric: InBodyMetric) {
    val min = metric.referenceMin ?: return
    val max = metric.referenceMax ?: return
    if (max <= min) return
    val pad = (max - min) * 0.4
    val lo = minOf(min, metric.value) - pad
    val hi = maxOf(max, metric.value) + pad
    val track = TextMuted.copy(alpha = 0.25f)
    val band = TextSecondary.copy(alpha = 0.45f)
    val dot = TextPrimary
    Canvas(modifier = Modifier.fillMaxWidth().height(10.dp).padding(top = 4.dp)) {
        fun at(point: Double) = (((point - lo) / (hi - lo)) * size.width).toFloat()
        val y = size.height / 2
        drawLine(track, Offset(0f, y), Offset(size.width, y), strokeWidth = 4.dp.toPx(), cap = StrokeCap.Round)
        drawLine(band, Offset(at(min), y), Offset(at(max), y), strokeWidth = 4.dp.toPx(), cap = StrokeCap.Round)
        drawCircle(dot, radius = 4.5.dp.toPx(), center = Offset(at(metric.value), y))
    }
}

@Composable
private fun MetricRow(metric: InBodyMetric, previous: TimelineEvent.InBody?, current: TimelineEvent.InBody) {
    val delta = formatDelta(current.delta(previous, metric.key).takeIf { metric.segment == null })
    val range = if (metric.referenceMin != null && metric.referenceMax != null) {
        stringResource(R.string.inbody_reference, "${formatReading(metric.referenceMin)}–${formatReading(metric.referenceMax)}")
    } else null
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
            Text(
                text = inBodyMetricLabel(metric),
                fontSize = 15.sp,
                color = TextSecondary,
                modifier = Modifier.weight(1f)
            )
            if (delta.isNotEmpty()) {
                Text(text = delta, fontSize = 12.sp, color = TextMuted, modifier = Modifier.padding(end = 8.dp))
            }
            Text(
                text = "${formatReading(metric.value)} ${metric.displayUnit()}".trim(),
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                fontFamily = FontFamily.Monospace,
                color = TextPrimary
            )
        }
        ReferenceBar(metric)
        val note = listOfNotNull(range, metric.evaluation?.let { evaluationTitle(it) }).joinToString(" · ")
        if (note.isNotEmpty()) {
            Text(text = note, fontSize = 11.sp, color = TextMuted, modifier = Modifier.padding(top = 2.dp))
        }
    }
}

@Composable
private fun SheetSection(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(text = title, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.2.sp, color = TextSecondary)
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(SurfaceCard)
                .border(1.dp, SurfaceCardBorder, RoundedCornerShape(16.dp))
        ) { content() }
    }
}

@Composable
private fun SegmentCell(event: TimelineEvent.InBody, kgKey: String, pctKey: String, segment: String, modifier: Modifier = Modifier) {
    val kg = event.metric(kgKey, segment)
    val pct = event.metric(pctKey, segment)
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Ink.copy(alpha = 0.35f))
            .padding(vertical = 10.dp, horizontal = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(text = segmentTitle(segment), fontSize = 11.sp, color = TextMuted)
        Text(
            text = kg?.let { "${formatReading(it.value)} ${it.displayUnit()}".trim() } ?: "–",
            fontSize = 17.sp,
            fontWeight = FontWeight.SemiBold,
            color = TextPrimary
        )
        val sub = listOfNotNull(pct?.let { "${formatReading(it.value)} %" }, pct?.evaluation?.let { evaluationTitle(it) }).joinToString(" · ")
        if (sub.isNotEmpty()) Text(text = sub, fontSize = 11.sp, color = TextSecondary)
    }
}

@Composable
private fun SegmentGrid(event: TimelineEvent.InBody, kgKey: String, pctKey: String) {
    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SegmentCell(event, kgKey, pctKey, "left_arm", Modifier.weight(1f))
            SegmentCell(event, kgKey, pctKey, "right_arm", Modifier.weight(1f))
        }
        SegmentCell(event, kgKey, pctKey, "trunk", Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SegmentCell(event, kgKey, pctKey, "left_leg", Modifier.weight(1f))
            SegmentCell(event, kgKey, pctKey, "right_leg", Modifier.weight(1f))
        }
    }
}

/** A line across the tests for one reading (Canvas, no chart library, like the activity chart). */
@Composable
fun InBodyTrendChart(values: List<Double>, firstLabel: String, lastLabel: String, modifier: Modifier = Modifier) {
    if (values.size < 2) return
    val line = TextPrimary
    val grid = TextMuted.copy(alpha = 0.3f)
    val min = values.min()
    val max = values.max()
    val span = if (max - min == 0.0) 1.0 else max - min
    Column(modifier = modifier) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(text = formatReading(max), fontSize = 11.sp, color = TextMuted)
        }
        Canvas(modifier = Modifier.fillMaxWidth().height(120.dp)) {
            val top = 8.dp.toPx()
            val bottom = size.height - 8.dp.toPx()
            fun x(index: Int) = index * (size.width / (values.size - 1))
            fun y(value: Double) = (bottom - ((value - min) / span).toFloat() * (bottom - top))
            listOf(top, (top + bottom) / 2, bottom).forEach { drawLine(grid, Offset(0f, it), Offset(size.width, it), strokeWidth = 1.dp.toPx()) }
            val path = Path()
            val fill = Path()
            values.forEachIndexed { index, value ->
                if (index == 0) {
                    path.moveTo(x(0), y(value))
                    fill.moveTo(x(0), bottom)
                    fill.lineTo(x(0), y(value))
                } else {
                    path.lineTo(x(index), y(value))
                    fill.lineTo(x(index), y(value))
                }
            }
            fill.lineTo(x(values.size - 1), bottom)
            fill.close()
            drawPath(fill, Brush.verticalGradient(listOf(line.copy(alpha = 0.16f), Color.Transparent), startY = top, endY = bottom))
            drawPath(path, line, style = Stroke(width = 2.5.dp.toPx(), cap = StrokeCap.Round))
            values.forEachIndexed { index, value ->
                drawCircle(line, radius = (if (index == values.lastIndex) 5.dp else 3.5.dp).toPx(), center = Offset(x(index), y(value)))
            }
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(text = firstLabel, fontSize = 11.sp, color = TextMuted)
            Text(text = formatReading(min), fontSize = 11.sp, color = TextMuted)
            Text(text = lastLabel, fontSize = 11.sp, color = TextMuted)
        }
    }
}

/**
 * One InBody test in full: key numbers with the change since the previous test, a trend across tests, what happened
 * between the tests (diet, steps, training, photos), every printed section with its normal range, the segment grids and
 * impedance, and the original sheet.
 */
@Composable
fun InBodyDetailSheet(
    event: TimelineEvent.InBody,
    /** Every InBody test, oldest first. */
    tests: List<TimelineEvent.InBody>,
    onDismiss: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val repo = FormApp.instance.bodyCompositionRepository
    val previous = tests.previousOf(event)

    var between by remember { mutableStateOf<BodyTest?>(null) }
    LaunchedEffect(event.id) {
        repo.getTests().onSuccess { loaded -> between = loaded.firstOrNull { it.id == event.id } }
    }
    var openingOriginal by remember { mutableStateOf(false) }
    var trendKey by remember { mutableStateOf("weight") }

    val appContext = LocalContext.current
    fun openOriginal() {
        val assetId = event.source?.assetId ?: return
        openingOriginal = true
        scope.launch {
            repo.downloadOriginal(assetId, event.source.fileName)
                .onSuccess { file ->
                    val uri = FileProvider.getUriForFile(appContext, "${appContext.packageName}.fileprovider", file)
                    val intent = Intent(Intent.ACTION_VIEW)
                        .setDataAndType(uri, event.source.mimeType ?: "*/*")
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    try {
                        appContext.startActivity(intent)
                    } catch (e: ActivityNotFoundException) {
                        Toast.makeText(appContext, appContext.getString(R.string.inbody_original_failed), Toast.LENGTH_SHORT).show()
                    }
                }
                .onFailure {
                    Toast.makeText(appContext, appContext.getString(R.string.inbody_original_failed), Toast.LENGTH_SHORT).show()
                }
            openingOriginal = false
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(Ink)) {
        Column(modifier = Modifier.fillMaxSize().padding(top = 40.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = stringResource(R.string.inbody_close),
                    style = MaterialTheme.typography.bodyLarge,
                    color = TextSecondary,
                    modifier = Modifier.clickable { onDismiss() }
                )
                Text(text = stringResource(R.string.inbody_title), style = MaterialTheme.typography.titleMedium, color = TextPrimary)
                Spacer(modifier = Modifier.width(48.dp))
            }

            Column(
                modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(text = formatEventDate(event.occurredAt, event.timezone), fontSize = 28.sp, fontFamily = FontFamily.Serif, color = TextPrimary)
                    Text(
                        text = listOfNotNull(
                            stringResource(if (event.reviewed) R.string.inbody_reviewed else R.string.inbody_not_reviewed),
                            event.device
                        ).joinToString(" · "),
                        fontSize = 13.sp,
                        color = TextSecondary
                    )
                }

                if (event.source?.assetId != null) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .border(1.dp, SurfaceCardBorder, RoundedCornerShape(14.dp))
                            .clickable(enabled = !openingOriginal) { openOriginal() }
                            .padding(14.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        if (openingOriginal) {
                            CircularProgressIndicator(modifier = Modifier.height(18.dp).width(18.dp), strokeWidth = 2.dp, color = Trace)
                        } else {
                            Text(text = stringResource(R.string.inbody_original), color = Trace, fontWeight = FontWeight.Medium)
                        }
                    }
                }

                val headline = INBODY_HEADLINE_KEYS.mapNotNull { event.metric(it) }
                if (headline.isNotEmpty()) {
                    SheetSection(stringResource(R.string.inbody_headline)) {
                        headline.chunked(2).forEach { pair ->
                            Row(modifier = Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                pair.forEach { metric ->
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(text = inBodyMetricLabel(metric), fontSize = 12.sp, color = TextSecondary)
                                        Text(
                                            text = "${formatReading(metric.value)} ${metric.displayUnit()}".trim(),
                                            fontSize = 24.sp,
                                            fontFamily = FontFamily.Serif,
                                            color = TextPrimary
                                        )
                                        Text(text = formatDelta(event.delta(previous, metric.key)), fontSize = 12.sp, color = TextMuted)
                                    }
                                }
                                if (pair.size == 1) Spacer(modifier = Modifier.weight(1f))
                            }
                        }
                    }
                    if (previous != null) {
                        Text(text = stringResource(R.string.inbody_since_previous), fontSize = 11.sp, color = TextMuted)
                    }
                }

                val trendKeys = INBODY_TREND_KEYS.filter { key -> tests.count { it.metric(key) != null } >= 2 }
                if (trendKeys.isNotEmpty()) {
                    val selectedKey = if (trendKey in trendKeys) trendKey else trendKeys.first()
                    SheetSection(stringResource(R.string.inbody_trend)) {
                        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                trendKeys.forEach { key ->
                                    val sample = tests.firstNotNullOf { it.metric(key) }
                                    val selected = key == selectedKey
                                    Text(
                                        text = inBodyMetricLabel(sample),
                                        fontSize = 13.sp,
                                        color = if (selected) Ink else TextSecondary,
                                        modifier = Modifier
                                            .clip(CircleShape)
                                            .background(if (selected) TextPrimary else Ink.copy(alpha = 0.35f))
                                            .clickable { trendKey = key }
                                            .padding(horizontal = 12.dp, vertical = 6.dp)
                                    )
                                }
                            }
                            val series = tests.filter { it.metric(selectedKey) != null }
                            InBodyTrendChart(
                                values = series.map { it.metric(selectedKey)!!.value },
                                firstLabel = formatEventDate(series.first().occurredAt, series.first().timezone),
                                lastLabel = formatEventDate(series.last().occurredAt, series.last().timezone)
                            )
                        }
                    }
                }

                between?.interval?.let { interval ->
                    SheetSection(stringResource(R.string.inbody_between, interval.days)) {
                        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            val nutrition = interval.nutrition
                            Text(
                                text = if (nutrition != null) {
                                    stringResource(
                                        R.string.inbody_diet_logged,
                                        nutrition.loggedDays, interval.days,
                                        nutrition.avgKcal?.let { formatReading(it) } ?: "–",
                                        nutrition.avgProteinG?.let { formatReading(it) } ?: "–"
                                    )
                                } else stringResource(R.string.inbody_no_diet),
                                fontSize = 14.sp, color = TextPrimary
                            )
                            Text(
                                text = interval.steps?.let { stringResource(R.string.inbody_steps, formatReading(it.avgSteps.toDouble())) } ?: stringResource(R.string.inbody_no_steps),
                                fontSize = 14.sp, color = TextPrimary
                            )
                            Text(
                                text = stringResource(R.string.inbody_workouts, interval.workouts.count, interval.workouts.setCount, interval.workouts.tonnageKg),
                                fontSize = 14.sp, color = TextPrimary
                            )
                            val photos = between?.photos.orEmpty()
                            if (photos.isNotEmpty()) {
                                Text(
                                    text = stringResource(R.string.inbody_photos, photos.joinToString(", ") { it.date }),
                                    fontSize = 14.sp, color = TextPrimary
                                )
                            }
                            between?.measurement?.let { tape ->
                                Text(
                                    text = stringResource(R.string.inbody_tape, tape.date) + tape.values.entries.take(3).joinToString("") { " · ${it.key.removeSuffix("Cm").removeSuffix("Kg")} ${formatReading(it.value)}" },
                                    fontSize = 14.sp, color = TextPrimary
                                )
                            }
                        }
                    }
                }

                INBODY_PLAIN_SECTIONS.forEach { category ->
                    val rows = event.metrics.filter { it.category == category && it.segment == null }
                    if (rows.isNotEmpty()) {
                        SheetSection(sectionTitle(category)) {
                            rows.forEach { MetricRow(it, previous, event) }
                        }
                    }
                }

                if (event.metrics.any { it.category == "segmental_lean" }) {
                    SheetSection(sectionTitle("segmental_lean")) { SegmentGrid(event, "lean_mass_kg", "lean_mass_pct") }
                }
                if (event.metrics.any { it.category == "segmental_fat" }) {
                    SheetSection(sectionTitle("segmental_fat")) { SegmentGrid(event, "fat_mass_kg", "fat_mass_pct") }
                }

                val impedance = event.metrics.filter { it.category == "impedance" && it.segment != null }
                if (impedance.isNotEmpty()) {
                    val frequencies = impedance.mapNotNull { it.frequencyKhz }.distinct().sorted()
                    SheetSection(sectionTitle("impedance")) {
                        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Spacer(modifier = Modifier.weight(1f))
                                frequencies.forEach { frequency ->
                                    Text(text = "${formatReading(frequency)} kHz", fontSize = 12.sp, color = TextMuted, modifier = Modifier.width(72.dp))
                                }
                            }
                            INBODY_SEGMENTS.forEach { segment ->
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text(text = segmentTitle(segment), fontSize = 14.sp, color = TextSecondary, modifier = Modifier.weight(1f))
                                    frequencies.forEach { frequency ->
                                        val value = event.metric("impedance_ohm", segment, frequency)?.value
                                        Text(
                                            text = value?.let { formatReading(it) } ?: "–",
                                            fontSize = 14.sp,
                                            fontFamily = FontFamily.Monospace,
                                            color = TextPrimary,
                                            modifier = Modifier.width(72.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }
}
