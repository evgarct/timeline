package com.evgarct.form.ui.timeline

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.evgarct.form.core.theme.GreenAccent
import com.evgarct.form.core.theme.LightInk
import com.evgarct.form.core.theme.RedAccent
import com.evgarct.form.core.theme.SurfaceCard
import com.evgarct.form.core.theme.SurfaceCardBorder
import com.evgarct.form.core.theme.TextMuted
import com.evgarct.form.core.theme.TextSecondary
import com.evgarct.form.core.theme.Trace
import com.evgarct.form.data.models.DeltaDirection
import com.evgarct.form.data.models.InBodyMetric
import com.evgarct.form.data.models.MeasurementDelta
import com.evgarct.form.data.models.PhotoItem
import com.evgarct.form.data.models.TimelineEvent
import com.evgarct.form.ui.components.GlassCard
import com.evgarct.form.ui.components.SerifNumber
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun TimelinePhotoCard(
    event: TimelineEvent.ProgressPhoto,
    onClick: () -> Unit
) {
    val photo = event.photos.firstOrNull()
    GlassCard(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column {
            if (photo != null) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(4f / 3f)
                        .clip(RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp))
                ) {
                    AsyncImage(
                        model = photo.url ?: photo.thumbnailUrl,
                        contentDescription = photo.alt,
                        modifier = Modifier.fillMaxWidth(),
                        contentScale = ContentScale.Crop
                    )
                    if (event.photos.size > 1) {
                        Box(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .padding(12.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color.Black.copy(alpha = 0.6f))
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = "${event.photos.size} photos",
                                color = LightInk,
                                fontSize = 12.sp
                            )
                        }
                    }
                }
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Photo session",
                    style = MaterialTheme.typography.titleMedium,
                    color = LightInk
                )
                Text(
                    text = formatEventTime(event.parsedDate),
                    style = MaterialTheme.typography.bodySmall,
                    color = TextMuted
                )
            }
        }
    }
}

@Composable
fun TimelineMeasurementsCard(
    event: TimelineEvent.Measurements,
    previousEvent: TimelineEvent.Measurements? = null
) {
    val current = event.values
    val prev = previousEvent?.values

    GlassCard(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            // Weight Headline
            if (current.weightKg != null) {
                val weightDelta = MeasurementDelta(current.weightKg, prev?.weightKg)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.Bottom,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text(
                            text = "WEIGHT",
                            style = MaterialTheme.typography.labelMedium,
                            color = Trace
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        SerifNumber(
                            value = String.format(Locale.US, "%.1f", current.weightKg),
                            unit = "kg",
                            fontSize = 36
                        )
                    }

                    if (weightDelta.change != null && weightDelta.direction != DeltaDirection.UNCHANGED) {
                        DeltaBadge(delta = weightDelta, unit = "kg")
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
            }

            // Grid of circumferences
            val items = listOfNotNull(
                current.chestCm?.let { "Chest" to MeasurementDelta(it, prev?.chestCm) },
                current.waistCm?.let { "Waist" to MeasurementDelta(it, prev?.waistCm) },
                current.abdomenCm?.let { "Abdomen" to MeasurementDelta(it, prev?.abdomenCm) },
                current.armRelaxed?.let { "Arm" to MeasurementDelta(it, prev?.armRelaxed) },
                current.armFlexed?.let { "Arm flexed" to MeasurementDelta(it, prev?.armFlexed) },
                current.forearmCm?.let { "Forearm" to MeasurementDelta(it, prev?.forearmCm) },
                current.hipsCm?.let { "Hips" to MeasurementDelta(it, prev?.hipsCm) },
                current.thigh?.let { "Thigh" to MeasurementDelta(it, prev?.thigh) },
                current.calf?.let { "Calf" to MeasurementDelta(it, prev?.calf) },
                current.neckCm?.let { "Neck" to MeasurementDelta(it, prev?.neckCm) }
            )

            if (items.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items.chunked(2).forEach { rowItems ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            rowItems.forEach { (label, delta) ->
                                Box(modifier = Modifier.weight(1f)) {
                                    MeasurementGridItem(label = label, delta = delta)
                                }
                            }
                            if (rowItems.size == 1) {
                                Spacer(modifier = Modifier.weight(1f))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun MeasurementGridItem(label: String, delta: MeasurementDelta) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(SurfaceCardBorder.copy(alpha = 0.4f))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column {
            Text(text = label, style = MaterialTheme.typography.bodySmall, color = TextSecondary)
            Text(
                text = "${String.format(Locale.US, "%.1f", delta.current)} cm",
                style = MaterialTheme.typography.bodyMedium,
                color = LightInk,
                fontWeight = androidx.compose.ui.text.font.FontWeight.Medium
            )
        }
        if (delta.change != null && delta.direction != DeltaDirection.UNCHANGED) {
            val isUp = delta.direction == DeltaDirection.INCREASED
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = if (isUp) Icons.Default.ArrowUpward else Icons.Default.ArrowDownward,
                    contentDescription = null,
                    tint = if (isUp) RedAccent else GreenAccent,
                    modifier = Modifier.size(12.dp)
                )
                Text(
                    text = String.format(Locale.US, "%.1f", kotlin.math.abs(delta.change ?: 0.0)),
                    fontSize = 11.sp,
                    color = if (isUp) RedAccent else GreenAccent
                )
            }
        }
    }
}

@Composable
fun DeltaBadge(delta: MeasurementDelta, unit: String) {
    val change = delta.change ?: return
    val isUp = delta.direction == DeltaDirection.INCREASED
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background((if (isUp) RedAccent else GreenAccent).copy(alpha = 0.15f))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = if (isUp) Icons.Default.ArrowUpward else Icons.Default.ArrowDownward,
            contentDescription = null,
            tint = if (isUp) RedAccent else GreenAccent,
            modifier = Modifier.size(14.dp)
        )
        Spacer(modifier = Modifier.width(2.dp))
        Text(
            text = "${if (isUp) "+" else "-"}${String.format(Locale.US, "%.1f", kotlin.math.abs(change))} $unit",
            color = if (isUp) RedAccent else GreenAccent,
            fontSize = 12.sp,
            fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold
        )
    }
}

@Composable
fun TimelineInBodyCard(event: TimelineEvent.InBody) {
    GlassCard(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.FitnessCenter,
                    contentDescription = null,
                    tint = Trace,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "INBODY BODY COMPOSITION",
                    style = MaterialTheme.typography.labelMedium,
                    color = Trace
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = formatEventTime(event.parsedDate),
                    style = MaterialTheme.typography.bodySmall,
                    color = TextMuted
                )
            }

            if (event.metrics.isNotEmpty()) {
                Spacer(modifier = Modifier.height(16.dp))
                val mainKeys = setOf("skeletal_muscle_mass", "percent_body_fat", "total_body_water", "body_fat_mass", "bmi")
                val displayed = event.metrics.filter { it.key in mainKeys }
                    .ifEmpty { event.metrics.take(4) }

                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    displayed.chunked(2).forEach { pair ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            pair.forEach { metric ->
                                InBodyMetricItem(metric, modifier = Modifier.weight(1f))
                            }
                            if (pair.size == 1) Spacer(modifier = Modifier.weight(1f))
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun InBodyMetricItem(metric: InBodyMetric, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(SurfaceCardBorder.copy(alpha = 0.4f))
            .padding(12.dp)
    ) {
        Text(text = metric.label, style = MaterialTheme.typography.bodySmall, color = TextSecondary)
        Spacer(modifier = Modifier.height(2.dp))
        Text(
            text = "${metric.value} ${metric.unit ?: ""}".trim(),
            style = MaterialTheme.typography.bodyLarge,
            color = LightInk,
            fontWeight = androidx.compose.ui.text.font.FontWeight.Medium
        )
    }
}

fun formatEventTime(date: Date): String {
    return SimpleDateFormat("HH:mm", Locale.getDefault()).format(date)
}
