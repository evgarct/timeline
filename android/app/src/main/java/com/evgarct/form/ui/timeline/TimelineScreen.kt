package com.evgarct.form.ui.timeline

import androidx.compose.foundation.background
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evgarct.form.FormApp
import com.evgarct.form.core.theme.Ink
import com.evgarct.form.core.theme.LightInk
import com.evgarct.form.core.theme.TextMuted
import com.evgarct.form.core.theme.Trace
import com.evgarct.form.data.models.DeltaDirection
import com.evgarct.form.data.models.MeasurementDelta
import com.evgarct.form.data.models.PhotoItem
import com.evgarct.form.data.models.TimelineEvent
import com.evgarct.form.ui.components.LoadingSpinner
import com.evgarct.form.ui.components.SectionEyebrow
import com.evgarct.form.ui.components.SerifNumber
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
    val latestMeasurements = measurementEvents.firstOrNull()
    val previousMeasurements = measurementEvents.getOrNull(1)

    val latestWeight = latestMeasurements?.values?.weightKg
    val weightDelta = if (latestWeight != null) {
        MeasurementDelta(latestWeight, previousMeasurements?.values?.weightKg)
    } else null

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Ink)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(top = 50.dp, start = 20.dp, end = 20.dp, bottom = 80.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    SectionEyebrow(text = "ARCHIVE")
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = "Timeline",
                        fontFamily = FontFamily.Serif,
                        fontSize = 32.sp,
                        color = LightInk
                    )
                }

                IconButton(
                    onClick = onOpenMeasurementEditor,
                    modifier = Modifier.size(44.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Add measurements",
                        tint = Trace,
                        modifier = Modifier.size(28.dp)
                    )
                }
            }

            // Latest Weight Headline
            if (latestWeight != null) {
                Spacer(modifier = Modifier.height(16.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.Bottom,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text(
                            text = "LATEST RECORDED STATE",
                            style = MaterialTheme.typography.labelSmall,
                            color = TextMuted
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        SerifNumber(
                            value = String.format(Locale.US, "%.1f", latestWeight),
                            unit = "kg",
                            fontSize = 40
                        )
                    }

                    if (weightDelta?.change != null && weightDelta.direction != DeltaDirection.UNCHANGED) {
                        DeltaBadge(delta = weightDelta, unit = "kg")
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            if (isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp),
                    contentAlignment = Alignment.Center
                ) {
                    LoadingSpinner()
                }
            } else if (events.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 48.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No timeline events recorded yet.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextMuted
                    )
                }
            } else {
                events.forEachIndexed { index, event ->
                    when (event) {
                        is TimelineEvent.ProgressPhoto -> {
                            TimelinePhotoCard(
                                event = event,
                                onClick = {
                                    onOpenPhotoGallery(event.id, event.photos, 0)
                                }
                            )
                        }
                        is TimelineEvent.Measurements -> {
                            val prev = measurementEvents.getOrNull(measurementEvents.indexOf(event) + 1)
                            TimelineMeasurementsCard(event = event, previousEvent = prev)
                        }
                        is TimelineEvent.InBody -> {
                            TimelineInBodyCard(event = event)
                        }
                        else -> {}
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                }
            }
        }
    }
}
