package com.evgarct.form.ui.today

import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.DirectionsBike
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.automirrored.filled.DirectionsWalk
import androidx.compose.material.icons.automirrored.filled.ShowChart
import androidx.compose.material.icons.filled.AccessibilityNew
import androidx.compose.material.icons.filled.Adjust
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Pool
import androidx.compose.material.icons.filled.SelfImprovement
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Sports
import androidx.compose.material.icons.filled.Straighten
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import com.evgarct.form.data.repository.WorkoutKind
import com.evgarct.form.data.repository.WorkoutSummary
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
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.health.connect.client.PermissionController
import com.evgarct.form.FormApp
import com.evgarct.form.R
import com.evgarct.form.data.repository.ActivityDataState
import com.evgarct.form.data.repository.DailyStepData
import kotlinx.coroutines.launch
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
    val scope = rememberCoroutineScope()

    var selectedDate by remember { mutableStateOf(initialDate) }
    var activityState by remember { mutableStateOf<ActivityDataState>(ActivityDataState.Loading) }
    var showDatePicker by remember { mutableStateOf(false) }
    var showGoalDialog by remember { mutableStateOf(false) }
    var goalInput by remember { mutableStateOf("${prefs.stepGoal}") }

    val today = remember { LocalDate.now() }

    fun refreshActivity() {
        scope.launch {
            activityState = ActivityDataState.Loading
            activityState = healthRepo.getActivityData(selectedDate, prefs.stepGoal)
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = PermissionController.createRequestPermissionResultContract()
    ) {
        refreshActivity()
    }

    LaunchedEffect(selectedDate) {
        refreshActivity()
    }

    val dateFormatter = remember { DateTimeFormatter.ofPattern("EEE, d MMMM", Locale.getDefault()) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF13110E))
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .padding(top = 10.dp)
        ) {
            // Toolbar (Trace symbol on left, glass Share & Close on right)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Icon(
                    painter = painterResource(id = R.drawable.ic_trace_primary),
                    contentDescription = "Form",
                    tint = Color.Unspecified,
                    modifier = Modifier.size(38.dp)
                )

                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    // Share Glass Button
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.12f))
                            .clickable(enabled = activityState is ActivityDataState.Value) {
                                val state = activityState as? ActivityDataState.Value ?: return@clickable
                                val workoutsSummary = if (state.workouts.isNotEmpty()) {
                                    " · " + state.workouts.joinToString(", ") { w ->
                                        val title = w.title ?: context.getString(w.kind.stringResId)
                                        val mins = w.durationSeconds / 60
                                        val kcal = w.totalEnergyBurnedKcal?.let { " (${it.toInt()} kcal)" } ?: ""
                                        "$title ($mins min$kcal)"
                                    }
                                } else ""
                                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                    type = "text/plain"
                                    putExtra(Intent.EXTRA_SUBJECT, "Form Activity")
                                    putExtra(
                                        Intent.EXTRA_TEXT,
                                        "Form Steps for ${dateFormatter.format(selectedDate)}: ${state.steps} / ${state.goal} steps (${((state.steps.toDouble() / state.goal) * 100).toInt()}%)$workoutsSummary"
                                    )
                                }
                                context.startActivity(Intent.createChooser(shareIntent, "Share Activity"))
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Share,
                            contentDescription = "Share",
                            tint = if (activityState is ActivityDataState.Value) Color.White else Color.White.copy(alpha = 0.4f),
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    // Close Glass Button
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.12f))
                            .clickable { onDismiss() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Close",
                            tint = Color.White,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }

            // Centered Glass Date Navigation Capsule
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.Center
            ) {
                Box(
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.12f))
                        .padding(horizontal = 6.dp, vertical = 4.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .clip(CircleShape)
                                .clickable { selectedDate = selectedDate.minusDays(1) },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Previous Day",
                                tint = Color.White,
                                modifier = Modifier.size(16.dp)
                            )
                        }

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .clickable { showDatePicker = true }
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.CalendarToday,
                                contentDescription = "Pick Date",
                                tint = Color.White.copy(alpha = 0.7f),
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = dateFormatter.format(selectedDate),
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Medium,
                                color = Color.White
                            )
                        }

                        val canGoForward = selectedDate.isBefore(today)
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .clip(CircleShape)
                                .clickable(enabled = canGoForward) {
                                    if (canGoForward) selectedDate = selectedDate.plusDays(1)
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                                contentDescription = "Next Day",
                                tint = if (canGoForward) Color.White else Color.White.copy(alpha = 0.25f),
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }

            // Body Content (Typographic, Zero Cards)
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 24.dp)
                    .padding(top = 20.dp, bottom = 40.dp),
                verticalArrangement = Arrangement.spacedBy(30.dp)
            ) {
                when (val state = activityState) {
                    is ActivityDataState.Loading -> {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(260.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(
                                color = Color.White.copy(alpha = 0.6f),
                                strokeWidth = 2.dp,
                                modifier = Modifier.size(32.dp)
                            )
                        }
                    }

                    is ActivityDataState.Denied -> {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 40.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Text(
                                text = "Activity",
                                fontSize = 48.sp,
                                fontFamily = FontFamily.Serif,
                                letterSpacing = (-1.2).sp,
                                color = Color.White
                            )

                            Text(
                                text = "Connect Health Connect to view your steps, walking distance, and weekly activity chart directly in Form.",
                                fontSize = 16.sp,
                                lineHeight = 24.sp,
                                color = Color.White.copy(alpha = 0.65f)
                            )

                            Spacer(modifier = Modifier.height(8.dp))

                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(22.dp))
                                    .background(Color.White.copy(alpha = 0.15f))
                                    .clickable { permissionLauncher.launch(healthRepo.permissions) }
                                    .padding(horizontal = 24.dp, vertical = 14.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "Grant Health Connect Access",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Color.White
                                )
                            }
                        }
                    }

                    is ActivityDataState.Unavailable -> {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 40.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Text(
                                text = "Activity",
                                fontSize = 48.sp,
                                fontFamily = FontFamily.Serif,
                                letterSpacing = (-1.2).sp,
                                color = Color.White
                            )

                            Text(
                                text = "Health Connect is not installed or unavailable on this device.",
                                fontSize = 16.sp,
                                lineHeight = 24.sp,
                                color = Color.White.copy(alpha = 0.65f)
                            )
                        }
                    }

                    is ActivityDataState.Value -> {
                        // Step Hero (Figure walk icon + Large serif number)
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.DirectionsWalk,
                                contentDescription = null,
                                tint = Color.White.copy(alpha = 0.5f),
                                modifier = Modifier.size(28.dp)
                            )
                            Text(
                                text = String.format(Locale.US, "%,d", state.steps),
                                fontSize = 84.sp,
                                fontFamily = FontFamily.Serif,
                                letterSpacing = (-2.5).sp,
                                color = Color.White
                            )
                        }

                        // Goal Progress (Target icon + goal + percentage + 5dp sleek capsule bar)
                        val fraction = if (state.goal > 0) {
                            (state.steps.toFloat() / state.goal).coerceIn(0f, 1f)
                        } else 0f
                        val percent = if (state.goal > 0) {
                            ((state.steps.toFloat() / state.goal) * 100).toInt()
                        } else 0

                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .clickable {
                                    goalInput = "${state.goal}"
                                    showGoalDialog = true
                                }
                                .padding(vertical = 4.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Adjust,
                                        contentDescription = null,
                                        tint = Color.White.copy(alpha = 0.5f),
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Text(
                                        text = String.format(Locale.US, "%,d", state.goal),
                                        fontSize = 15.sp,
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Medium,
                                        color = Color.White
                                    )
                                }

                                Text(
                                    text = "$percent%",
                                    fontSize = 15.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Medium,
                                    color = Color.White.copy(alpha = 0.85f)
                                )
                            }

                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(5.dp)
                                    .clip(CircleShape)
                                    .background(Color.White.copy(alpha = 0.12f))
                            ) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth(fraction)
                                        .fillMaxHeight()
                                        .clip(CircleShape)
                                        .background(Color.White)
                                )
                            }
                        }

                        // Workouts (Stands out through typography and spacing alone per docs/DESIGN.md)
                        if (state.workouts.isNotEmpty()) {
                            WorkoutsSection(workouts = state.workouts)
                        }

                        // Weekly Section (Average + Smooth Spline Chart)
                        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.ShowChart,
                                    contentDescription = null,
                                    tint = Color.White.copy(alpha = 0.5f),
                                    modifier = Modifier.size(20.dp)
                                )
                                Text(
                                    text = "Ø",
                                    fontSize = 16.sp,
                                    color = Color.White.copy(alpha = 0.5f)
                                )
                                Text(
                                    text = String.format(Locale.US, "%,d", state.weeklyAverage),
                                    fontSize = 34.sp,
                                    fontFamily = FontFamily.Serif,
                                    fontWeight = FontWeight.Normal,
                                    color = Color.White
                                )
                            }

                            ActivityWeekCurveChart(
                                weeklyData = state.weeklySteps,
                                selectedDate = selectedDate,
                                average = state.weeklyAverage,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(240.dp)
                            )
                        }

                        // Distance Row
                        if (state.distanceMeters != null && state.distanceMeters > 0) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Straighten,
                                    contentDescription = null,
                                    tint = Color.White.copy(alpha = 0.5f),
                                    modifier = Modifier.size(22.dp)
                                )
                                Text(
                                    text = String.format(Locale.US, "%.1f km", state.distanceMeters / 1000.0),
                                    fontSize = 30.sp,
                                    fontFamily = FontFamily.Serif,
                                    fontWeight = FontWeight.Normal,
                                    color = Color.White
                                )
                            }
                        }
                    }
                }
            }
        }

        // Step Goal Editor Dialog
        if (showGoalDialog) {
            AlertDialog(
                onDismissRequest = { showGoalDialog = false },
                title = {
                    Text(
                        text = stringResource(R.string.activity_goal_title),
                        color = Color.White,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text(
                            text = stringResource(R.string.activity_goal_message),
                            color = Color.White.copy(alpha = 0.7f),
                            fontSize = 14.sp
                        )

                        // Presets
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            listOf(8000, 10000, 12000, 15000).forEach { preset ->
                                val isSelected = goalInput == "$preset"
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(CircleShape)
                                        .background(if (isSelected) Color.White else Color.White.copy(alpha = 0.12f))
                                        .clickable { goalInput = "$preset" }
                                        .padding(vertical = 8.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = String.format(Locale.US, "%,d", preset).replace(',', ' '),
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = if (isSelected) Color.Black else Color.White
                                    )
                                }
                            }
                        }

                        OutlinedTextField(
                            value = goalInput,
                            onValueChange = { input ->
                                goalInput = input.filter { it.isDigit() }.take(6)
                            },
                            label = { Text(stringResource(R.string.activity_goal_placeholder)) },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedBorderColor = Color.White,
                                unfocusedBorderColor = Color.White.copy(alpha = 0.3f),
                                focusedLabelColor = Color.White,
                                unfocusedLabelColor = Color.White.copy(alpha = 0.6f)
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    TextButton(
                        onClick = {
                            val newGoal = goalInput.toIntOrNull()
                            if (newGoal != null && newGoal in 1_000..100_000) {
                                prefs.stepGoal = newGoal
                                refreshActivity()
                            }
                            showGoalDialog = false
                        }
                    ) {
                        Text(stringResource(R.string.common_save), color = Color.White, fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showGoalDialog = false }) {
                        Text(stringResource(R.string.common_cancel), color = Color.White.copy(alpha = 0.6f))
                    }
                },
                containerColor = Color(0xFF1E1C1A),
                shape = RoundedCornerShape(24.dp)
            )
        }

        // Date Picker Dialog
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
                        Text("Done", color = Color.White)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showDatePicker = false }) {
                        Text("Cancel", color = Color.White.copy(alpha = 0.6f))
                    }
                }
            ) {
                DatePicker(state = datePickerState)
            }
        }
    }
}

@Composable
fun ActivityWeekCurveChart(
    weeklyData: List<DailyStepData>,
    selectedDate: LocalDate,
    average: Long,
    modifier: Modifier = Modifier
) {
    val dayFormatter = remember { DateTimeFormatter.ofPattern("E", Locale.getDefault()) }
    val maxSteps = maxOf(weeklyData.maxOfOrNull { it.steps } ?: 1L, average, 1L)

    Column(modifier = modifier) {
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                if (weeklyData.isEmpty()) return@Canvas

                val width = size.width
                val height = size.height
                val pointSpacing = if (weeklyData.size > 1) width / (weeklyData.size - 1) else width

                // Compute points
                val points = weeklyData.mapIndexed { index, item ->
                    val x = index * pointSpacing
                    val y = height - (item.steps.toFloat() / maxSteps * (height - 30f)) - 10f
                    Offset(x, y)
                }

                // Average dashed line
                if (average > 0) {
                    val avgY = height - (average.toFloat() / maxSteps * (height - 30f)) - 10f
                    drawLine(
                        color = Color.White.copy(alpha = 0.25f),
                        start = Offset(0f, avgY),
                        end = Offset(width, avgY),
                        strokeWidth = 1.5.dp.toPx(),
                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(12f, 12f), 0f)
                    )
                }

                // Smooth Spline Line and Gradient Fill
                val linePath = Path()
                val fillPath = Path()

                points.forEachIndexed { i, pt ->
                    if (i == 0) {
                        linePath.moveTo(pt.x, pt.y)
                        fillPath.moveTo(pt.x, height)
                        fillPath.lineTo(pt.x, pt.y)
                    } else {
                        val prev = points[i - 1]
                        val cx1 = prev.x + (pt.x - prev.x) / 2f
                        val cy1 = prev.y
                        val cx2 = prev.x + (pt.x - prev.x) / 2f
                        val cy2 = pt.y
                        linePath.cubicTo(cx1, cy1, cx2, cy2, pt.x, pt.y)
                        fillPath.cubicTo(cx1, cy1, cx2, cy2, pt.x, pt.y)
                    }
                }

                fillPath.lineTo(points.last().x, height)
                fillPath.close()

                // Draw gradient fill under curve
                drawPath(
                    path = fillPath,
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            Color.White.copy(alpha = 0.16f),
                            Color.Transparent
                        ),
                        startY = 0f,
                        endY = height
                    )
                )

                // Draw stroke
                drawPath(
                    path = linePath,
                    color = Color.White,
                    style = Stroke(
                        width = 3.dp.toPx(),
                        cap = StrokeCap.Round,
                        join = StrokeJoin.Round
                    )
                )

                // Point marks
                points.forEachIndexed { i, pt ->
                    val item = weeklyData[i]
                    val isSelected = item.date == selectedDate
                    if (isSelected) {
                        // Halo ring
                        drawCircle(
                            color = Color.White.copy(alpha = 0.3f),
                            radius = 9.dp.toPx(),
                            center = pt
                        )
                        // Solid core
                        drawCircle(
                            color = Color.White,
                            radius = 5.dp.toPx(),
                            center = pt
                        )
                    } else {
                        drawCircle(
                            color = Color.White.copy(alpha = 0.5f),
                            radius = 3.5.dp.toPx(),
                            center = pt
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Weekday labels
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            weeklyData.forEach { item ->
                val isSelected = item.date == selectedDate
                Text(
                    text = dayFormatter.format(item.date).take(1),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (isSelected) Color.White else Color.White.copy(alpha = 0.4f),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.width(24.dp)
                )
            }
        }
    }
}

@Composable
fun WorkoutsSection(
    workouts: List<WorkoutSummary>,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = stringResource(R.string.activity_workouts_title).uppercase(),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 1.2.sp,
            color = Color.White.copy(alpha = 0.5f)
        )

        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            workouts.forEach { workout ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.Top,
                    horizontalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .padding(top = 2.dp)
                            .size(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = getWorkoutIcon(workout.kind),
                            contentDescription = null,
                            tint = Color(0xFFC7A58E),
                            modifier = Modifier.size(22.dp)
                        )
                    }

                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = workout.title ?: stringResource(workout.kind.stringResId),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.White
                        )

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            val totalMinutes = workout.durationSeconds / 60
                            val durText = if (totalMinutes < 60) {
                                stringResource(R.string.activity_duration_minutes_format, totalMinutes)
                            } else {
                                val hours = totalMinutes / 60
                                val mins = totalMinutes % 60
                                stringResource(R.string.activity_duration_hours_minutes_format, hours, mins)
                            }
                            Text(
                                text = durText,
                                fontSize = 14.sp,
                                fontFamily = FontFamily.Monospace,
                                color = Color.White.copy(alpha = 0.6f)
                            )
                            if (workout.totalEnergyBurnedKcal != null && workout.totalEnergyBurnedKcal > 0) {
                                Text(
                                    text = "·",
                                    fontSize = 14.sp,
                                    color = Color.White.copy(alpha = 0.4f)
                                )
                                Text(
                                    text = stringResource(R.string.activity_calories_format, workout.totalEnergyBurnedKcal.toInt()),
                                    fontSize = 14.sp,
                                    fontFamily = FontFamily.Monospace,
                                    color = Color.White.copy(alpha = 0.6f)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

fun getWorkoutIcon(kind: WorkoutKind): androidx.compose.ui.graphics.vector.ImageVector {
    return when (kind) {
        WorkoutKind.RUNNING -> Icons.AutoMirrored.Filled.DirectionsRun
        WorkoutKind.WALKING -> Icons.AutoMirrored.Filled.DirectionsWalk
        WorkoutKind.CYCLING -> Icons.AutoMirrored.Filled.DirectionsBike
        WorkoutKind.SWIMMING -> Icons.Default.Pool
        WorkoutKind.YOGA -> Icons.Default.SelfImprovement
        WorkoutKind.STRENGTH -> Icons.Default.FitnessCenter
        WorkoutKind.HIIT -> Icons.Default.Bolt
        WorkoutKind.CORE -> Icons.Default.AccessibilityNew
        WorkoutKind.ELLIPTICAL -> Icons.AutoMirrored.Filled.DirectionsWalk
        WorkoutKind.HIKING -> Icons.AutoMirrored.Filled.DirectionsWalk
        WorkoutKind.ROWING -> Icons.Default.FitnessCenter
        WorkoutKind.OTHER -> Icons.Default.Sports
    }
}

