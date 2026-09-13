package com.evgarct.form.ui.activity

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.DirectionsBike
import androidx.compose.material.icons.automirrored.rounded.DirectionsRun
import androidx.compose.material.icons.automirrored.rounded.DirectionsWalk
import androidx.compose.material.icons.automirrored.rounded.ShowChart
import androidx.compose.material.icons.rounded.AccessibilityNew
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.FitnessCenter
import androidx.compose.material.icons.rounded.Pool
import androidx.compose.material.icons.rounded.SelfImprovement
import androidx.compose.material.icons.rounded.Sports
import androidx.compose.material.icons.rounded.Straighten
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evgarct.form.R
import com.evgarct.form.data.repository.ActivityDataState
import com.evgarct.form.data.repository.DailyStepData
import com.evgarct.form.data.repository.WorkoutKind
import com.evgarct.form.data.repository.WorkoutSummary
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Shared body content for the Activity feature — used both by the Today-launched
 * modal (`ActivityDetailSheet`) and the persistent Activity tab (`ActivityScreen`),
 * so both stay visually identical without duplicating this Compose tree.
 */
@Composable
fun ActivityContent(
    selectedDate: LocalDate,
    activityState: ActivityDataState,
    onRequestPermission: () -> Unit,
    onEditGoal: () -> Unit,
    modifier: Modifier = Modifier,
    extraContent: (@Composable ColumnScope.() -> Unit)? = null
) {
    Column(
        modifier = modifier
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
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
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
                        color = MaterialTheme.colorScheme.onBackground
                    )

                    Text(
                        text = "Connect Health Connect to view your steps, walking distance, and weekly activity chart directly in Form.",
                        fontSize = 16.sp,
                        lineHeight = 24.sp,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.65f)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(22.dp))
                            .background(MaterialTheme.colorScheme.onBackground.copy(alpha = 0.15f))
                            .clickable { onRequestPermission() }
                            .padding(horizontal = 24.dp, vertical = 14.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Grant Health Connect Access",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onBackground
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
                        color = MaterialTheme.colorScheme.onBackground
                    )

                    Text(
                        text = "Health Connect is not installed or unavailable on this device.",
                        fontSize = 16.sp,
                        lineHeight = 24.sp,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.65f)
                    )
                }
            }

            is ActivityDataState.Value -> {
                // Hero (big serif number + goal subtitle + circular ring gauge),
                // styled after Health Connect's own native "Steps" screen.
                val fraction = if (state.goal > 0) {
                    (state.steps.toFloat() / state.goal).coerceIn(0f, 1f)
                } else 0f
                val remaining = (state.goal - state.steps).coerceAtLeast(0)

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .clickable { onEditGoal() },
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Row(verticalAlignment = Alignment.Bottom) {
                            Text(
                                text = String.format(Locale.US, "%,d", state.steps),
                                fontSize = 56.sp,
                                fontFamily = FontFamily.Serif,
                                letterSpacing = (-1.5).sp,
                                color = MaterialTheme.colorScheme.onBackground
                            )
                            Text(
                                text = " of " + String.format(Locale.US, "%,d", state.goal) + " steps",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Medium,
                                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                                modifier = Modifier.padding(bottom = 10.dp)
                            )
                        }
                        Text(
                            text = if (remaining <= 0) {
                                "Daily goal reached — nice work."
                            } else {
                                String.format(Locale.US, "%,d", remaining) + " steps to go"
                            },
                            fontSize = 14.sp,
                            lineHeight = 19.sp,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.65f)
                        )
                    }

                    Spacer(modifier = Modifier.width(16.dp))

                    Box(
                        modifier = Modifier.size(64.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(
                            progress = { 1f },
                            modifier = Modifier.size(64.dp),
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.12f),
                            strokeWidth = 5.dp,
                            strokeCap = StrokeCap.Round
                        )
                        CircularProgressIndicator(
                            progress = { fraction },
                            modifier = Modifier.size(64.dp),
                            color = MaterialTheme.colorScheme.primary,
                            strokeWidth = 5.dp,
                            strokeCap = StrokeCap.Round
                        )
                        Icon(
                            imageVector = Icons.AutoMirrored.Rounded.DirectionsWalk,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onBackground,
                            modifier = Modifier.size(24.dp)
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
                            imageVector = Icons.AutoMirrored.Rounded.ShowChart,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                            modifier = Modifier.size(20.dp)
                        )
                        Text(
                            text = "Ø",
                            fontSize = 16.sp,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
                        )
                        Text(
                            text = String.format(Locale.US, "%,d", state.weeklyAverage),
                            fontSize = 34.sp,
                            fontFamily = FontFamily.Serif,
                            fontWeight = FontWeight.Normal,
                            color = MaterialTheme.colorScheme.onBackground
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
                            imageVector = Icons.Rounded.Straighten,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                            modifier = Modifier.size(22.dp)
                        )
                        Text(
                            text = String.format(Locale.US, "%.1f km", state.distanceMeters / 1000.0),
                            fontSize = 30.sp,
                            fontFamily = FontFamily.Serif,
                            fontWeight = FontWeight.Normal,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                    }
                }
            }
        }

        extraContent?.invoke(this)
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
    val lineColor = MaterialTheme.colorScheme.onBackground

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
                        color = lineColor.copy(alpha = 0.25f),
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
                            lineColor.copy(alpha = 0.16f),
                            Color.Transparent
                        ),
                        startY = 0f,
                        endY = height
                    )
                )

                // Draw stroke
                drawPath(
                    path = linePath,
                    color = lineColor,
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
                            color = lineColor.copy(alpha = 0.3f),
                            radius = 9.dp.toPx(),
                            center = pt
                        )
                        // Solid core
                        drawCircle(
                            color = lineColor,
                            radius = 5.dp.toPx(),
                            center = pt
                        )
                    } else {
                        drawCircle(
                            color = lineColor.copy(alpha = 0.5f),
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
                    color = if (isSelected) lineColor else lineColor.copy(alpha = 0.4f),
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
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
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
                            tint = MaterialTheme.colorScheme.primary,
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
                            color = MaterialTheme.colorScheme.onBackground
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
                                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                            )
                            if (workout.totalEnergyBurnedKcal != null && workout.totalEnergyBurnedKcal > 0) {
                                Text(
                                    text = "·",
                                    fontSize = 14.sp,
                                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)
                                )
                                Text(
                                    text = stringResource(R.string.activity_calories_format, workout.totalEnergyBurnedKcal.toInt()),
                                    fontSize = 14.sp,
                                    fontFamily = FontFamily.Monospace,
                                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
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
        WorkoutKind.RUNNING -> Icons.AutoMirrored.Rounded.DirectionsRun
        WorkoutKind.WALKING -> Icons.AutoMirrored.Rounded.DirectionsWalk
        WorkoutKind.CYCLING -> Icons.AutoMirrored.Rounded.DirectionsBike
        WorkoutKind.SWIMMING -> Icons.Rounded.Pool
        WorkoutKind.YOGA -> Icons.Rounded.SelfImprovement
        WorkoutKind.STRENGTH -> Icons.Rounded.FitnessCenter
        WorkoutKind.HIIT -> Icons.Rounded.Bolt
        WorkoutKind.CORE -> Icons.Rounded.AccessibilityNew
        WorkoutKind.ELLIPTICAL -> Icons.AutoMirrored.Rounded.DirectionsWalk
        WorkoutKind.HIKING -> Icons.AutoMirrored.Rounded.DirectionsWalk
        WorkoutKind.ROWING -> Icons.Rounded.FitnessCenter
        WorkoutKind.OTHER -> Icons.Rounded.Sports
    }
}
