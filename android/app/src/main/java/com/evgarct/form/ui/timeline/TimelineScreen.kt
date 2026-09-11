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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evgarct.form.FormApp
import com.evgarct.form.R
import com.evgarct.form.data.models.PhotoItem
import com.evgarct.form.data.models.TimelineEvent
import kotlinx.coroutines.launch
import java.util.Locale

@Composable
fun TimelineScreen(
    onOpenPhotoGallery: (String, List<PhotoItem>, Int) -> Unit,
    onOpenMeasurementEditor: () -> Unit
) {
    val timelineRepo = FormApp.instance.timelineRepository
    val scope = rememberCoroutineScope()
    var events by remember { mutableStateOf<List<TimelineEvent>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    fun load() {
        isLoading = true
        scope.launch {
            timelineRepo.getEvents()
                .onSuccess {
                    events = it.filter { event -> event !is TimelineEvent.NutritionEntry }
                    isLoading = false
                }
                .onFailure {
                    isLoading = false
                }
        }
    }

    LaunchedEffect(Unit) {
        load()
    }

    val measurementEvents = events.filterIsInstance<TimelineEvent.Measurements>()
    val latestMeasurements = measurementEvents.firstOrNull()?.values
    val previousMeasurements = measurementEvents.getOrNull(1)?.values

    val latestWeight = latestMeasurements?.weightKg
    val weightDelta = if (latestWeight != null && previousMeasurements?.weightKg != null) {
        latestWeight - previousMeasurements.weightKg!!
    } else null

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF13110E))
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .statusBarsPadding()
                .padding(horizontal = 18.dp)
                .padding(top = 16.dp, bottom = 110.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            // Editorial Header
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            text = stringResource(R.string.timeline_eyebrow),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = 1.6.sp,
                            color = Color.White.copy(alpha = 0.6f)
                        )
                        Text(
                            text = stringResource(R.string.timeline_title),
                            fontSize = 45.sp,
                            fontFamily = FontFamily.Serif,
                            letterSpacing = (-1.4).sp,
                            color = Color.White
                        )
                    }

                    // Glass + Button
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.15f))
                            .clickable { onOpenMeasurementEditor() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = stringResource(R.string.timeline_add_measurements),
                            tint = Color.White,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                }

                // Latest Weight Banner
                if (latestWeight != null) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.Bottom
                        ) {
                            Row(verticalAlignment = Alignment.Bottom) {
                                Text(
                                    text = String.format(Locale.US, "%.1f", latestWeight),
                                    fontSize = 58.sp,
                                    fontWeight = FontWeight.Light,
                                    fontFamily = FontFamily.Serif,
                                    color = Color.White
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = stringResource(R.string.measurement_kg),
                                    fontSize = 20.sp,
                                    color = Color.White.copy(alpha = 0.6f),
                                    modifier = Modifier.padding(bottom = 8.dp)
                                )
                            }

                            if (weightDelta != null) {
                                Row(
                                    verticalAlignment = Alignment.Bottom,
                                    modifier = Modifier.padding(bottom = 8.dp)
                                ) {
                                    Text(
                                        text = String.format(Locale.US, "%+.2f", weightDelta),
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = Color.White.copy(alpha = 0.7f)
                                    )
                                    Spacer(modifier = Modifier.width(3.dp))
                                    Text(
                                        text = stringResource(R.string.measurement_kg),
                                        fontSize = 12.sp,
                                        color = Color.White.copy(alpha = 0.4f)
                                    )
                                }
                            }
                        }

                        Text(
                            text = stringResource(R.string.timeline_latest_caption),
                            fontSize = 14.sp,
                            color = Color.White.copy(alpha = 0.6f)
                        )
                    }
                }
            }

            // Events List
            if (isLoading && events.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 40.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(
                        color = Color.White,
                        modifier = Modifier.size(24.dp),
                        strokeWidth = 2.dp
                    )
                }
            } else if (events.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 40.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = stringResource(R.string.timeline_empty),
                        color = Color.White.copy(alpha = 0.5f),
                        fontSize = 16.sp
                    )
                }
            } else {
                events.forEach { event ->
                    when (event) {
                        is TimelineEvent.ProgressPhoto -> {
                            TimelinePhotoItem(
                                event = event,
                                onClick = {
                                    onOpenPhotoGallery(event.id, event.photos, 0)
                                }
                            )
                        }
                        is TimelineEvent.Measurements -> {
                            val prev = measurementEvents.getOrNull(measurementEvents.indexOf(event) + 1)
                            TimelineMeasurementsItem(event = event, previous = prev)
                        }
                        is TimelineEvent.InBody -> {
                            TimelineInBodyItem(event = event)
                        }
                        else -> Unit
                    }
                }
            }
        }
    }
}
