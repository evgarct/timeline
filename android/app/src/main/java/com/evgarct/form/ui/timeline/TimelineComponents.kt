package com.evgarct.form.ui.timeline

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Photo
import androidx.compose.material.icons.filled.Straighten
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.evgarct.form.R
import com.evgarct.form.data.models.TimelineEvent
import java.text.SimpleDateFormat
import java.util.Locale

@Composable
fun TimelinePhotoItem(
    event: TimelineEvent.ProgressPhoto,
    onClick: () -> Unit
) {
    val photo = event.photos.firstOrNull()
    val dateText = try {
        val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        val date = parser.parse(event.occurredAt.take(19))
        SimpleDateFormat("d MMMM yyyy", Locale.getDefault()).format(date ?: java.util.Date())
    } catch (e: Exception) {
        event.occurredAt.take(10)
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(420.dp)
            .clip(RoundedCornerShape(24.dp))
            .background(Color(0xFF201A15))
            .clickable(onClick = onClick)
    ) {
        if (photo != null) {
            AsyncImage(
                model = photo.url ?: photo.thumbnailUrl,
                contentDescription = photo.alt,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
        } else {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            listOf(Color(0xFF4D3F35), Color(0xFF1A1613))
                        )
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Photo,
                    contentDescription = null,
                    modifier = Modifier.size(64.dp),
                    tint = Color.White.copy(alpha = 0.3f)
                )
            }
        }

        // Bottom gradient for readability
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(140.dp)
                .align(Alignment.BottomStart)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.75f))
                    )
                )
        )

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomStart)
                .padding(20.dp),
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(
                    text = stringResource(R.string.timeline_photo_session),
                    fontSize = 17.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(3.dp))
                Text(
                    text = dateText,
                    fontSize = 14.sp,
                    color = Color.White.copy(alpha = 0.72f)
                )
            }

            if (event.photos.size > 1) {
                Box(
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(Color.Black.copy(alpha = 0.5f))
                        .padding(horizontal = 10.dp, vertical = 5.dp)
                ) {
                    Text(
                        text = "+${event.photos.size - 1}",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color.White
                    )
                }
            }
        }
    }
}

@Composable
fun TimelineMeasurementsItem(
    event: TimelineEvent.Measurements,
    previous: TimelineEvent.Measurements?
) {
    val values = event.values
    val prevValues = previous?.values
    val weight = values.weightKg

    val dateText = try {
        val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        val date = parser.parse(event.occurredAt.take(19))
        SimpleDateFormat("d MMMM yyyy", Locale.getDefault()).format(date ?: java.util.Date())
    } catch (e: Exception) {
        event.occurredAt.take(10)
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Straighten,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.6f),
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = stringResource(R.string.timeline_event_measurements),
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White
                )
            }

            if (weight != null) {
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        text = String.format(Locale.US, "%.1f", weight),
                        fontSize = 22.sp,
                        fontFamily = FontFamily.Serif,
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = stringResource(R.string.measurement_kg),
                        fontSize = 13.sp,
                        color = Color.White.copy(alpha = 0.6f),
                        modifier = Modifier.padding(bottom = 2.dp)
                    )

                    if (prevValues?.weightKg != null) {
                        val diff = weight - prevValues.weightKg!!
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = String.format(Locale.US, "%+.1f", diff),
                            fontSize = 14.sp,
                            fontFamily = FontFamily.Monospace,
                            color = Color.White.copy(alpha = 0.5f),
                            modifier = Modifier.padding(bottom = 2.dp)
                        )
                    }
                }
            }
        }

        // Thin hairline separator
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(Color.White.copy(alpha = 0.08f))
        )

        // Measurements flow
        val parts = listOfNotNull(
            values.chestCm?.let { "Chest" to it to prevValues?.chestCm },
            values.waistCm?.let { "Waist" to it to prevValues?.waistCm },
            values.abdomenCm?.let { "Abdomen" to it to prevValues?.abdomenCm },
            values.hipsCm?.let { "Hips" to it to prevValues?.hipsCm },
            values.leftBicepCm?.let { "Bicep" to it to prevValues?.leftBicepCm },
            values.leftThighCm?.let { "Thigh" to it to prevValues?.leftThighCm },
            values.leftCalfCm?.let { "Calf" to it to prevValues?.leftCalfCm }
        )

        if (parts.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                parts.forEach { (item, prevVal) ->
                    val (name, currentVal) = item
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = name,
                            fontSize = 15.sp,
                            color = Color.White.copy(alpha = 0.6f)
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            if (prevVal != null) {
                                val delta = currentVal - prevVal
                                if (kotlin.math.abs(delta) >= 0.1) {
                                    Text(
                                        text = String.format(Locale.US, "%+.1f", delta),
                                        fontSize = 13.sp,
                                        color = Color.White.copy(alpha = 0.45f),
                                        fontFamily = FontFamily.Monospace
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                }
                            }
                            Text(
                                text = String.format(Locale.US, "%.1f cm", currentVal),
                                fontSize = 15.sp,
                                fontFamily = FontFamily.Monospace,
                                color = Color.White
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun TimelineInBodyItem(event: TimelineEvent.InBody) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.FitnessCenter,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.6f),
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "InBody Scan",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White
                )
            }

            val weight = event.metrics.find { it.key.contains("weight", ignoreCase = true) }?.value
            if (weight != null) {
                Text(
                    text = "$weight kg",
                    fontSize = 20.sp,
                    fontFamily = FontFamily.Serif,
                    color = Color.White
                )
            }
        }

        // Thin hairline separator
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(Color.White.copy(alpha = 0.08f))
        )

        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            event.metrics.take(6).forEach { metric ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = metric.label,
                        fontSize = 15.sp,
                        color = Color.White.copy(alpha = 0.6f)
                    )
                    Text(
                        text = "${metric.value} ${metric.unit}",
                        fontSize = 15.sp,
                        fontFamily = FontFamily.Monospace,
                        color = Color.White
                    )
                }
            }
        }
    }
}
