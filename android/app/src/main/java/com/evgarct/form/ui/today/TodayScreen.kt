package com.evgarct.form.ui.today

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
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
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsWalk
import androidx.compose.material.icons.filled.BakeryDining
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.OilBarrel
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.collectAsState
import androidx.lifecycle.viewmodel.compose.viewModel
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
import com.evgarct.form.FormApp
import com.evgarct.form.R
import com.evgarct.form.core.theme.LightInk
import com.evgarct.form.core.theme.Ink
import com.evgarct.form.core.theme.SurfaceCard
import com.evgarct.form.core.theme.TextMuted
import com.evgarct.form.core.theme.TextPrimary
import com.evgarct.form.core.theme.TextSecondary
import com.evgarct.form.data.models.NutritionSummary
import com.evgarct.form.data.models.PhotoItem
import com.evgarct.form.data.models.TimelineEvent
import com.evgarct.form.data.repository.ActivityDataState
import com.evgarct.form.ui.timeline.TimelineInBodyItem
import com.evgarct.form.ui.timeline.TimelineMeasurementsItem
import com.evgarct.form.ui.timeline.TimelinePhotoItem
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.time.LocalDate
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun TodayScreen(
    onOpenSettings: () -> Unit,
    onOpenPhotoGallery: (String, List<PhotoItem>, Int) -> Unit,
    onOpenActivityDetail: (LocalDate) -> Unit,
    onOpenNutrition: () -> Unit
) {
    val timelineRepo = FormApp.instance.timelineRepository
    val prefs = FormApp.instance.appPreferences
    val scope = rememberCoroutineScope()
    val viewModel: TodayViewModel = viewModel()

    var events by remember { mutableStateOf<List<TimelineEvent>>(emptyList()) }
    var showStepGoalDialog by remember { mutableStateOf(false) }
    var goalInput by remember { mutableStateOf("${prefs.stepGoal}") }

    val nutritionCacheMap by viewModel.nutritionState.collectAsState()
    val activityCacheMap by viewModel.activityState.collectAsState()
    val todaySummary = remember(nutritionCacheMap) {
        NutritionSummary.fromEntries(viewModel.nutritionDayState().entries)
    }
    val activityState = remember(activityCacheMap) { viewModel.activityDayState().data }

    LaunchedEffect(Unit) {
        scope.launch { timelineRepo.getEvents().onSuccess { events = it } }
        viewModel.refresh()
    }

    // Latest photo session
    val photoEvents = events.filterIsInstance<TimelineEvent.ProgressPhoto>()
    val latestPhotoEvent = photoEvents.firstOrNull()
    val latestPhotos = latestPhotoEvent?.photos ?: emptyList()

    val scrollState = rememberScrollState()

    val dateFormatted = remember {
        SimpleDateFormat("d MMMM", Locale.getDefault()).format(Date())
    }

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(Ink)
    ) {
        val heroHeight = maxHeight
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
        ) {
            // VIEWPORT 1: Hero Photo Surface
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(heroHeight)
            ) {
                // Background Photo Layer
                if (latestPhotos.isNotEmpty()) {
                    val pagerState = rememberPagerState(pageCount = { latestPhotos.size })
                    HorizontalPager(
                        state = pagerState,
                        modifier = Modifier.fillMaxSize()
                    ) { page ->
                        val photo = latestPhotos[page]
                        AsyncImage(
                            model = photo.url ?: photo.thumbnailUrl,
                            contentDescription = photo.alt,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                    }
                } else {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(
                                Brush.verticalGradient(
                                    colors = listOf(
                                        Color(0xFF382E24),
                                        Ink,
                                        Color.Black
                                    )
                                )
                            )
                    )
                }

                // Vignette / top-bottom read gradients
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                colorStops = arrayOf(
                                    0.0f to Color.Black.copy(alpha = 0.55f),
                                    0.22f to Color.Transparent,
                                    0.60f to Color.Transparent,
                                    0.82f to Color.Black.copy(alpha = 0.85f),
                                    1.0f to Color.Black
                                )
                            )
                        )
                )

                // Foreground Content
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .statusBarsPadding()
                        .padding(horizontal = 18.dp)
                        .padding(top = 20.dp, bottom = 24.dp),
                    verticalArrangement = Arrangement.SpaceBetween
                ) {
                    // Header
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.Top
                    ) {
                        Column {
                            Text(
                                text = stringResource(R.string.today_label),
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Medium,
                                letterSpacing = 0.7.sp,
                                color = LightInk.copy(alpha = 0.75f)
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = dateFormatted,
                                fontSize = 52.sp,
                                fontFamily = FontFamily.Serif,
                                letterSpacing = (-1.2).sp,
                                color = LightInk
                            )
                        }

                        // Glass Ellipsis Button
                        Box(
                            modifier = Modifier
                                .size(42.dp)
                                .clip(CircleShape)
                                .background(LightInk.copy(alpha = 0.15f))
                                .clickable { onOpenSettings() },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.MoreHoriz,
                                contentDescription = stringResource(R.string.action_menu),
                                tint = LightInk,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }

                    // Bottom Chrome over Photo
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        // Photo actions (Compare / All photos)
                        if (latestPhotos.isNotEmpty()) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(38.dp)
                                        .clip(RoundedCornerShape(19.dp))
                                        .background(LightInk.copy(alpha = 0.15f))
                                        .clickable {
                                            latestPhotoEvent?.let {
                                                onOpenPhotoGallery(it.id, latestPhotos, 0)
                                            }
                                        },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = stringResource(R.string.action_allphotos),
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = LightInk
                                    )
                                }
                            }
                        }

                        // Summary Cards
                        val steps = when (val s = activityState) {
                            is ActivityDataState.Value -> s.steps.toInt()
                            else -> 0
                        }
                        val workoutsCount = when (val s = activityState) {
                            is ActivityDataState.Value -> s.workouts.size
                            else -> 0
                        }
                        val stepGoal = prefs.stepGoal
                        val stepPercent = if (stepGoal > 0) (steps * 100 / stepGoal) else 0
                        val colorScheme = MaterialTheme.colorScheme

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            SummaryStatCard(
                                modifier = Modifier.weight(1f),
                                containerColor = colorScheme.primaryContainer.copy(alpha = 0.9f),
                                onContainerColor = colorScheme.onPrimaryContainer,
                                icon = Icons.Default.Restaurant,
                                label = stringResource(R.string.summary_nutrition),
                                value = "${todaySummary.calories.toInt()}",
                                unit = stringResource(R.string.summary_calories_unit),
                                detailIcons = listOf(
                                    Icons.Default.FitnessCenter to "${todaySummary.protein.toInt()}",
                                    Icons.Default.OilBarrel to "${todaySummary.fat.toInt()}",
                                    Icons.Default.BakeryDining to "${todaySummary.carbohydrates.toInt()}"
                                ),
                                onClick = onOpenNutrition
                            )
                            SummaryStatCard(
                                modifier = Modifier.weight(1f),
                                containerColor = colorScheme.secondaryContainer.copy(alpha = 0.9f),
                                onContainerColor = colorScheme.onSecondaryContainer,
                                icon = Icons.AutoMirrored.Filled.DirectionsWalk,
                                label = stringResource(R.string.summary_activity),
                                value = String.format(Locale.US, "%,d", steps),
                                unit = stringResource(R.string.summary_steps_unit_short),
                                detail = if (workoutsCount > 0) {
                                    "${stringResource(R.string.activity_workouts_count_format, workoutsCount)} · ${String.format(Locale.US, "%,d", stepGoal)} · $stepPercent%"
                                } else {
                                    "${String.format(Locale.US, "%,d", stepGoal)} · $stepPercent%"
                                },
                                onClick = { onOpenActivityDetail(LocalDate.now()) },
                                onLongClick = {
                                    goalInput = "${prefs.stepGoal}"
                                    showStepGoalDialog = true
                                }
                            )
                        }
                    }
                }
            }

            // Step Goal Editor Dialog
            if (showStepGoalDialog) {
                AlertDialog(
                    onDismissRequest = { showStepGoalDialog = false },
                    title = {
                        Text(
                            text = stringResource(R.string.activity_goal_title),
                            color = TextPrimary,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    },
                    text = {
                        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            Text(
                                text = stringResource(R.string.activity_goal_message),
                                color = TextSecondary,
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
                                            .background(if (isSelected) TextPrimary else TextPrimary.copy(alpha = 0.12f))
                                            .clickable { goalInput = "$preset" }
                                            .padding(vertical = 8.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = String.format(Locale.US, "%,d", preset).replace(',', ' '),
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Medium,
                                            color = if (isSelected) Ink else TextPrimary
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
                                    focusedTextColor = TextPrimary,
                                    unfocusedTextColor = TextPrimary,
                                    focusedBorderColor = TextPrimary,
                                    unfocusedBorderColor = TextSecondary,
                                    focusedLabelColor = TextPrimary,
                                    unfocusedLabelColor = TextSecondary
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
                                    viewModel.refresh(force = true)
                                }
                                showStepGoalDialog = false
                            }
                        ) {
                            Text(stringResource(R.string.common_save), color = TextPrimary, fontWeight = FontWeight.Bold)
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = { showStepGoalDialog = false }) {
                            Text(stringResource(R.string.common_cancel), color = TextSecondary)
                        }
                    },
                    containerColor = SurfaceCard,
                    shape = RoundedCornerShape(24.dp)
                )
            }

            // VIEWPORT 2: Timeline Archive (Same Scroll Document)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Ink)
                    .padding(horizontal = 18.dp)
                    .padding(top = 36.dp, bottom = 120.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = stringResource(R.string.timeline_eyebrow),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 1.6.sp,
                        color = TextSecondary
                    )
                    Text(
                        text = stringResource(R.string.timeline_title),
                        fontSize = 44.sp,
                        fontFamily = FontFamily.Serif,
                        letterSpacing = (-1.2).sp,
                        color = TextPrimary
                    )
                }

                // Group events by day
                val nonNutritionEvents = events.filter { it !is TimelineEvent.NutritionEntry }
                val measurementEvents = nonNutritionEvents.filterIsInstance<TimelineEvent.Measurements>()

                if (nonNutritionEvents.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 40.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = stringResource(R.string.timeline_empty),
                            color = TextMuted,
                            fontSize = 16.sp
                        )
                    }
                } else {
                    nonNutritionEvents.forEachIndexed { index, event ->
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
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun SummaryStatCard(
    modifier: Modifier,
    containerColor: Color,
    onContainerColor: Color,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    value: String,
    unit: String,
    detail: String? = null,
    detailIcons: List<Pair<androidx.compose.ui.graphics.vector.ImageVector, String>>? = null,
    onClick: () -> Unit,
    onLongClick: (() -> Unit)? = null
) {
    val cardModifier = if (onLongClick != null) {
        modifier.combinedClickable(onClick = onClick, onLongClick = onLongClick)
    } else {
        modifier.clickable(onClick = onClick)
    }
    Column(
        modifier = cardModifier
            .clip(RoundedCornerShape(24.dp))
            .background(containerColor)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = onContainerColor.copy(alpha = 0.7f),
                modifier = Modifier.size(12.dp)
            )
            Text(
                text = label.uppercase(),
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                letterSpacing = 0.5.sp,
                color = onContainerColor.copy(alpha = 0.7f)
            )
        }
        Row(verticalAlignment = Alignment.Bottom) {
            Text(
                text = value,
                fontSize = 28.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.SemiBold,
                color = onContainerColor
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = unit,
                fontSize = 12.sp,
                color = onContainerColor.copy(alpha = 0.7f),
                modifier = Modifier.padding(bottom = 4.dp)
            )
        }
        if (detailIcons != null) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                detailIcons.forEach { (detailIcon, text) ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                        Icon(
                            imageVector = detailIcon,
                            contentDescription = null,
                            tint = onContainerColor.copy(alpha = 0.6f),
                            modifier = Modifier.size(11.dp)
                        )
                        Text(
                            text = text,
                            fontSize = 12.sp,
                            fontFamily = FontFamily.Monospace,
                            color = onContainerColor.copy(alpha = 0.7f)
                        )
                    }
                }
            }
        } else if (detail != null) {
            Text(
                text = detail,
                fontSize = 12.sp,
                color = onContainerColor.copy(alpha = 0.7f)
            )
        }
    }
}
