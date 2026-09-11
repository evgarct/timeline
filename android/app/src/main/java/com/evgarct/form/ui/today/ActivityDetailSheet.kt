package com.evgarct.form.ui.today

import android.content.Intent
import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DirectionsWalk
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evgarct.form.FormApp
import com.evgarct.form.R
import com.evgarct.form.core.theme.Ink
import com.evgarct.form.core.theme.LightInk
import com.evgarct.form.core.theme.SurfaceCard
import com.evgarct.form.core.theme.SurfaceCardBorder
import com.evgarct.form.core.theme.TextMuted
import com.evgarct.form.core.theme.TextSecondary
import com.evgarct.form.core.theme.Trace
import com.evgarct.form.data.repository.ActivityDataState
import com.evgarct.form.data.repository.DailyStepData
import com.evgarct.form.ui.components.GlassCard
import com.evgarct.form.ui.components.LinearProgressBar
import com.evgarct.form.ui.components.LoadingSpinner
import com.evgarct.form.ui.components.SerifNumber
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActivityDetailSheet(
    initialDate: LocalDate = LocalDate.now(),
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val healthRepo = FormApp.instance.healthConnectRepository
    val prefs = FormApp.instance.appPreferences

    var selectedDate by remember { mutableStateOf(initialDate) }
    var activityState by remember { mutableStateOf<ActivityDataState>(ActivityDataState.Loading) }
    var showDatePicker by remember { mutableStateOf(false) }

    val today = remember { LocalDate.now() }
    val stepGoal = prefs.stepGoal

    LaunchedEffect(selectedDate) {
        activityState = ActivityDataState.Loading
        activityState = healthRepo.getActivityData(selectedDate, stepGoal)
    }

    val dateFormatter = remember { DateTimeFormatter.ofPattern("EEEE, d MMMM", Locale.getDefault()) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Ink)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(top = 40.dp)
        ) {
            // Header Toolbar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    painter = painterResource(id = R.drawable.ic_trace_primary),
                    contentDescription = "Form",
                    tint = Color.Unspecified,
                    modifier = Modifier.size(28.dp)
                )

                Spacer(modifier = Modifier.weight(1f))

                IconButton(
                    onClick = {
                        val state = activityState as? ActivityDataState.Value ?: return@IconButton
                        val shareIntent = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_SUBJECT, "Form Activity")
                            putExtra(
                                Intent.EXTRA_TEXT,
                                "Form Steps for ${dateFormatter.format(selectedDate)}: ${state.steps} / ${state.goal} steps (${((state.steps.toDouble() / state.goal) * 100).toInt()}%)"
                            )
                        }
                        context.startActivity(Intent.createChooser(shareIntent, "Share Activity"))
                    },
                    enabled = activityState is ActivityDataState.Value
                ) {
                    Icon(
                        imageVector = Icons.Default.Share,
                        contentDescription = "Share",
                        tint = if (activityState is ActivityDataState.Value) LightInk else TextMuted
                    )
                }

                IconButton(onClick = onDismiss) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Close",
                        tint = LightInk
                    )
                }
            }

            // Date Navigation
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                IconButton(onClick = { selectedDate = selectedDate.minusDays(1) }) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Previous Day", tint = LightInk)
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.clickable { showDatePicker = true }
                ) {
                    Text(
                        text = dateFormatter.format(selectedDate),
                        style = MaterialTheme.typography.titleMedium,
                        color = LightInk
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Icon(
                        imageVector = Icons.Default.CalendarToday,
                        contentDescription = "Pick Date",
                        tint = Trace,
                        modifier = Modifier.size(16.dp)
                    )
                }

                IconButton(
                    onClick = { if (selectedDate.isBefore(today)) selectedDate = selectedDate.plusDays(1) },
                    enabled = selectedDate.isBefore(today)
                ) {
                    Icon(
                        Icons.Default.ArrowForward,
                        contentDescription = "Next Day",
                        tint = if (selectedDate.isBefore(today)) LightInk else TextMuted
                    )
                }
            }

            // Content
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 12.dp)
            ) {
                when (val state = activityState) {
                    is ActivityDataState.Loading -> {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(200.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            LoadingSpinner()
                        }
                    }
                    is ActivityDataState.Value -> {
                        GlassCard(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(20.dp)
                        ) {
                            Column(modifier = Modifier.padding(20.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Default.DirectionsWalk,
                                        contentDescription = null,
                                        tint = Trace,
                                        modifier = Modifier.size(24.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "DAILY ACTIVITY",
                                        style = MaterialTheme.typography.labelMedium,
                                        color = Trace
                                    )
                                }

                                Spacer(modifier = Modifier.height(16.dp))

                                SerifNumber(
                                    value = String.format(Locale.getDefault(), "%,d", state.steps),
                                    unit = "steps",
                                    fontSize = 44
                                )

                                Spacer(modifier = Modifier.height(12.dp))

                                val percent = if (state.goal > 0) {
                                    ((state.steps.toFloat() / state.goal) * 100).toInt()
                                } else 0

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = "Goal: ${String.format(Locale.getDefault(), "%,d", state.goal)}",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = TextSecondary
                                    )
                                    Text(
                                        text = "$percent%",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = if (percent >= 100) Trace else TextSecondary,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }

                                Spacer(modifier = Modifier.height(8.dp))

                                LinearProgressBar(
                                    progress = if (state.goal > 0) state.steps.toFloat() / state.goal else 0f,
                                    color = Trace,
                                    height = 6.dp
                                )

                                if (state.distanceMeters != null && state.distanceMeters > 0) {
                                    Spacer(modifier = Modifier.height(16.dp))
                                    Text(
                                        text = String.format(Locale.getDefault(), "Distance: %.2f km", state.distanceMeters / 1000.0),
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = TextSecondary
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(24.dp))

                        // Weekly Chart
                        GlassCard(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(20.dp)
                        ) {
                            Column(modifier = Modifier.padding(20.dp)) {
                                Text(
                                    text = "WEEKLY TREND",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = Trace
                                )

                                Spacer(modifier = Modifier.height(8.dp))

                                Row(verticalAlignment = Alignment.Bottom) {
                                    Text(
                                        text = String.format(Locale.getDefault(), "%,d", state.weeklyAverage),
                                        fontFamily = FontFamily.Serif,
                                        fontSize = 28.sp,
                                        color = LightInk
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = "avg steps / day",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextSecondary,
                                        modifier = Modifier.padding(bottom = 4.dp)
                                    )
                                }

                                Spacer(modifier = Modifier.height(20.dp))

                                WeekBarChart(
                                    weeklyData = state.weeklySteps,
                                    selectedDate = selectedDate,
                                    average = state.weeklyAverage,
                                    goal = state.goal,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(140.dp)
                                )
                            }
                        }
                    }
                    is ActivityDataState.Denied -> {
                        GlassCard(modifier = Modifier.fillMaxWidth()) {
                            Column(
                                modifier = Modifier.padding(24.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(
                                    text = "Health Connect Access Denied",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = LightInk
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Grant Health Connect permissions to view your steps and distance.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = TextSecondary
                                )
                            }
                        }
                    }
                    is ActivityDataState.Unavailable -> {
                        GlassCard(modifier = Modifier.fillMaxWidth()) {
                            Column(
                                modifier = Modifier.padding(24.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(
                                    text = "Health Connect Unavailable",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = LightInk
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Health Connect is not available on this device or not configured.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = TextSecondary
                                )
                            }
                        }
                    }
                }
            }
        }

        if (showDatePicker) {
            val datePickerState = rememberDatePickerState(
                initialSelectedDateMillis = selectedDate.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
            )
            DatePickerDialog(
                onDismissRequest = { showDatePicker = false },
                confirmButton = {
                    TextButton(
                        onClick = {
                            datePickerState.selectedDateMillis?.let { millis ->
                                selectedDate = Instant.ofEpochMilli(millis).atZone(ZoneId.systemDefault()).toLocalDate()
                            }
                            showDatePicker = false
                        }
                    ) {
                        Text("OK", color = Trace)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showDatePicker = false }) {
                        Text("Cancel", color = TextSecondary)
                    }
                }
            ) {
                DatePicker(state = datePickerState)
            }
        }
    }
}

@Composable
fun WeekBarChart(
    weeklyData: List<DailyStepData>,
    selectedDate: LocalDate,
    average: Long,
    goal: Int,
    modifier: Modifier = Modifier
) {
    val dayFormatter = remember { DateTimeFormatter.ofPattern("E", Locale.getDefault()) }
    val maxVal = maxOf(weeklyData.maxOfOrNull { it.steps } ?: 1L, goal.toLong(), average)

    Column(modifier = modifier) {
        Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val canvasWidth = size.width
                val canvasHeight = size.height
                val barWidth = 24.dp.toPx()
                val stepX = canvasWidth / weeklyData.size.coerceAtLeast(1)

                // Dashed line for average
                if (average > 0 && maxVal > 0) {
                    val avgY = canvasHeight - (average.toFloat() / maxVal * canvasHeight)
                    drawLine(
                        color = Color(0x66806450),
                        start = Offset(0f, avgY),
                        end = Offset(canvasWidth, avgY),
                        strokeWidth = 1.5.dp.toPx(),
                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 10f), 0f)
                    )
                }

                // Draw bars
                weeklyData.forEachIndexed { index, item ->
                    val barHeight = (item.steps.toFloat() / maxVal * (canvasHeight - 10f)).coerceAtLeast(4f)
                    val x = index * stepX + (stepX - barWidth) / 2f
                    val y = canvasHeight - barHeight

                    val isSelected = item.date == selectedDate
                    val color = when {
                        isSelected -> Trace
                        item.steps >= goal -> Color(0xFF685242)
                        else -> Color(0xFF38342D)
                    }

                    drawRoundRect(
                        color = color,
                        topLeft = Offset(x, y),
                        size = Size(barWidth, barHeight),
                        cornerRadius = CornerRadius(4.dp.toPx(), 4.dp.toPx())
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(6.dp))

        // Days of week labels
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceAround
        ) {
            weeklyData.forEach { item ->
                val isSelected = item.date == selectedDate
                Text(
                    text = dayFormatter.format(item.date).take(3),
                    fontSize = 11.sp,
                    color = if (isSelected) Trace else TextMuted,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                )
            }
        }
    }
}
