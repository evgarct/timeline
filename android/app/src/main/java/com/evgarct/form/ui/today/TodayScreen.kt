package com.evgarct.form.ui.today

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.evgarct.form.FormApp
import com.evgarct.form.core.theme.Ink
import com.evgarct.form.core.theme.LightInk
import com.evgarct.form.core.theme.SurfaceCard
import com.evgarct.form.core.theme.SurfaceCardBorder
import com.evgarct.form.core.theme.TextMuted
import com.evgarct.form.core.theme.TextSecondary
import com.evgarct.form.core.theme.Trace
import com.evgarct.form.data.models.NutritionSummary
import com.evgarct.form.data.models.PhotoItem
import com.evgarct.form.data.models.TimelineEvent
import com.evgarct.form.data.repository.ActivityDataState
import com.evgarct.form.ui.components.GlassCard
import com.evgarct.form.ui.components.LinearProgressBar
import com.evgarct.form.ui.components.LoadingSpinner
import com.evgarct.form.ui.components.SectionEyebrow
import com.evgarct.form.ui.components.SerifNumber
import com.evgarct.form.ui.timeline.TimelineInBodyCard
import com.evgarct.form.ui.timeline.TimelineMeasurementsCard
import com.evgarct.form.ui.timeline.TimelinePhotoCard
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.time.LocalDate
import java.util.Date
import java.util.Locale
import java.util.TimeZone

@Composable
fun TodayScreen(
    onOpenSettings: () -> Unit,
    onOpenPhotoGallery: (String, List<PhotoItem>, Int) -> Unit,
    onOpenActivityDetail: (LocalDate) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val timelineRepo = FormApp.instance.timelineRepository
    val nutritionRepo = FormApp.instance.nutritionRepository
    val healthRepo = FormApp.instance.healthConnectRepository
    val prefs = FormApp.instance.appPreferences

    var events by remember { mutableStateOf<List<TimelineEvent>>(emptyList()) }
    var todaySummary by remember { mutableStateOf(NutritionSummary()) }
    var activityState by remember { mutableStateOf<ActivityDataState>(ActivityDataState.Loading) }
    var isLoading by remember { mutableStateOf(true) }
    var isRefreshingActivity by remember { mutableStateOf(false) }

    var showActivityMenu by remember { mutableStateOf(false) }
    var showSetGoalDialog by remember { mutableStateOf(false) }
    var stepGoalInput by remember { mutableStateOf(prefs.stepGoal.toString()) }
    var showCompareToast by remember { mutableStateOf(false) }

    fun refreshAll() {
        scope.launch {
            isLoading = true
            val eventsDeferred = async { timelineRepo.getEvents() }
            val nutritionDeferred = async { nutritionRepo.getEntries(Date(), TimeZone.getDefault()) }
            val activityDeferred = async { healthRepo.getActivityData(LocalDate.now(), prefs.stepGoal) }

            val eventsResult = eventsDeferred.await()
            val nutritionResult = nutritionDeferred.await()
            val activityResult = activityDeferred.await()

            eventsResult.onSuccess { events = it }
            nutritionResult.onSuccess { entries ->
                todaySummary = NutritionSummary.fromEntries(entries)
            }
            activityState = activityResult
            isLoading = false
        }
    }

    LaunchedEffect(Unit) {
        refreshAll()
    }

    val latestPhotoEvent = events.filterIsInstance<TimelineEvent.ProgressPhoto>().firstOrNull()
    val pinnedId = latestPhotoEvent?.let { prefs.getCoverPhotoId(it.id) }
    val heroPhotos = latestPhotoEvent?.photos ?: emptyList()

    val initialHeroIndex = if (pinnedId != null) {
        heroPhotos.indexOfFirst { it.id == pinnedId }.coerceAtLeast(0)
    } else 0

    val pagerState = rememberPagerState(initialPage = initialHeroIndex, pageCount = { heroPhotos.size })

    val dateFormatter = remember { SimpleDateFormat("EEEE, d MMMM", Locale.getDefault()) }
    val todayDateStr = dateFormatter.format(latestPhotoEvent?.parsedDate ?: Date())

    val scrollState = rememberScrollState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Ink)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
        ) {
            // Hero Section
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(0.85f)
            ) {
                // Background Photo Carousel
                if (heroPhotos.isNotEmpty()) {
                    HorizontalPager(
                        state = pagerState,
                        modifier = Modifier.fillMaxSize()
                    ) { page ->
                        val photo = heroPhotos[page]
                        AsyncImage(
                            model = photo.url ?: photo.thumbnailUrl,
                            contentDescription = photo.alt,
                            modifier = Modifier
                                .fillMaxSize()
                                .clickable {
                                    latestPhotoEvent?.let {
                                        onOpenPhotoGallery(it.id, heroPhotos, page)
                                    }
                                },
                            contentScale = ContentScale.Crop
                        )
                    }
                } else {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(
                                Brush.verticalGradient(
                                    listOf(Color(0xFF2B2620), Color(0xFF15130F))
                                )
                            )
                    )
                }

                // Top & Bottom Gradients
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                0.0f to Ink.copy(alpha = 0.7f),
                                0.25f to Color.Transparent,
                                0.65f to Color.Transparent,
                                1.0f to Ink
                            )
                        )
                )

                // Header Overlay
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(top = 44.dp, start = 20.dp, end = 20.dp, bottom = 16.dp),
                    verticalArrangement = Arrangement.SpaceBetween
                ) {
                    // Eyebrow & Settings Button
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            SectionEyebrow(text = "TODAY")
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = todayDateStr,
                                fontFamily = FontFamily.Serif,
                                fontSize = 28.sp,
                                color = LightInk
                            )
                        }

                        IconButton(onClick = onOpenSettings) {
                            Icon(
                                imageVector = Icons.Default.MoreHoriz,
                                contentDescription = "Settings",
                                tint = LightInk
                            )
                        }
                    }

                    // Bottom of Hero: Photo actions & Summary Capsule
                    Column {
                        if (heroPhotos.isNotEmpty()) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                if (heroPhotos.size > 1) {
                                    Text(
                                        text = "${pagerState.currentPage + 1} / ${heroPhotos.size}",
                                        fontSize = 12.sp,
                                        color = LightInk.copy(alpha = 0.8f),
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(6.dp))
                                            .background(Color.Black.copy(alpha = 0.4f))
                                            .padding(horizontal = 8.dp, vertical = 4.dp)
                                    )
                                } else {
                                    Spacer(modifier = Modifier.width(1.dp))
                                }

                                Row {
                                    Text(
                                        text = "All Photos",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = LightInk,
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(Color.Black.copy(alpha = 0.4f))
                                            .clickable {
                                                latestPhotoEvent?.let {
                                                    onOpenPhotoGallery(it.id, heroPhotos, pagerState.currentPage)
                                                }
                                            }
                                            .padding(horizontal = 10.dp, vertical = 5.dp)
                                    )
                                }
                            }
                        }

                        // Summary Capsule
                        GlassCard(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(18.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                // Nutrition Column
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = "NUTRITION",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = Trace
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    SerifNumber(
                                        value = todaySummary.calories.toInt().toString(),
                                        unit = "kcal",
                                        fontSize = 26
                                    )
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(
                                        text = "${todaySummary.protein.toInt()}p / ${todaySummary.fat.toInt()}f / ${todaySummary.carbohydrates.toInt()}c",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextSecondary
                                    )
                                }

                                Box(
                                    modifier = Modifier
                                        .width(1.dp)
                                        .height(56.dp)
                                        .background(SurfaceCardBorder)
                                )

                                // Activity Column
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .padding(start = 16.dp)
                                        .pointerInput(Unit) {
                                            detectTapGestures(
                                                onTap = {
                                                    scope.launch {
                                                        isRefreshingActivity = true
                                                        activityState = healthRepo.getActivityData(LocalDate.now(), prefs.stepGoal)
                                                        isRefreshingActivity = false
                                                    }
                                                },
                                                onLongPress = {
                                                    showActivityMenu = true
                                                }
                                            )
                                        }
                                ) {
                                    Column {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(
                                                text = "ACTIVITY",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = Trace
                                            )
                                            if (isRefreshingActivity) {
                                                LoadingSpinner(size = 14.dp)
                                            } else {
                                                Icon(
                                                    imageVector = Icons.Default.Refresh,
                                                    contentDescription = "Refresh",
                                                    tint = TextMuted,
                                                    modifier = Modifier.size(14.dp)
                                                )
                                            }
                                        }

                                        Spacer(modifier = Modifier.height(4.dp))

                                        when (val state = activityState) {
                                            is ActivityDataState.Value -> {
                                                SerifNumber(
                                                    value = String.format(Locale.getDefault(), "%,d", state.steps),
                                                    fontSize = 26
                                                )
                                                Spacer(modifier = Modifier.height(4.dp))
                                                val progress = if (state.goal > 0) state.steps.toFloat() / state.goal else 0f
                                                LinearProgressBar(progress = progress, height = 3.dp)
                                                Spacer(modifier = Modifier.height(2.dp))
                                                val percent = (progress * 100).toInt()
                                                Text(
                                                    text = "$percent% of ${state.goal / 1000}k goal",
                                                    style = MaterialTheme.typography.bodySmall,
                                                    color = TextMuted
                                                )
                                            }
                                            is ActivityDataState.Denied -> {
                                                Text("Tap to connect", style = MaterialTheme.typography.bodySmall, color = TextMuted)
                                            }
                                            else -> {
                                                Text("Steps unavailable", style = MaterialTheme.typography.bodySmall, color = TextMuted)
                                            }
                                        }
                                    }

                                    DropdownMenu(
                                        expanded = showActivityMenu,
                                        onDismissRequest = { showActivityMenu = false }
                                    ) {
                                        DropdownMenuItem(
                                            text = { Text("Set goal") },
                                            onClick = {
                                                showActivityMenu = false
                                                showSetGoalDialog = true
                                            }
                                        )
                                        DropdownMenuItem(
                                            text = { Text("Detail") },
                                            onClick = {
                                                showActivityMenu = false
                                                onOpenActivityDetail(LocalDate.now())
                                            }
                                        )
                                        DropdownMenuItem(
                                            text = { Text("Share") },
                                            onClick = {
                                                showActivityMenu = false
                                                val state = activityState as? ActivityDataState.Value
                                                if (state != null) {
                                                    val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                                        type = "text/plain"
                                                        putExtra(Intent.EXTRA_TEXT, "Form Steps Today: ${state.steps} / ${state.goal} steps")
                                                    }
                                                    context.startActivity(Intent.createChooser(shareIntent, "Share Activity"))
                                                }
                                            }
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Embedded Timeline Archive
            Column(modifier = Modifier.padding(horizontal = 20.dp)) {
                SectionEyebrow(text = "ARCHIVE")
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Timeline",
                    fontFamily = FontFamily.Serif,
                    fontSize = 24.sp,
                    color = LightInk
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Exclude hero photo event
                val archiveEvents = events.filter { it.id != latestPhotoEvent?.id }
                    .filter { it !is TimelineEvent.NutritionEntry }

                if (archiveEvents.isEmpty()) {
                    Text(
                        text = "No other entries recorded yet.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextMuted,
                        modifier = Modifier.padding(vertical = 16.dp)
                    )
                } else {
                    val measurementEvents = archiveEvents.filterIsInstance<TimelineEvent.Measurements>()
                    archiveEvents.forEachIndexed { index, event ->
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

                Spacer(modifier = Modifier.height(80.dp))
            }
        }

        // Set Goal Dialog
        if (showSetGoalDialog) {
            AlertDialog(
                onDismissRequest = { showSetGoalDialog = false },
                title = { Text("Set Step Goal") },
                text = {
                    OutlinedTextField(
                        value = stepGoalInput,
                        onValueChange = { stepGoalInput = it.filter { c -> c.isDigit() } },
                        label = { Text("Steps") },
                        singleLine = true
                    )
                },
                confirmButton = {
                    TextButton(onClick = {
                        val newGoal = stepGoalInput.toIntOrNull()?.coerceIn(100, 100000) ?: 10000
                        prefs.stepGoal = newGoal
                        showSetGoalDialog = false
                        scope.launch {
                            activityState = healthRepo.getActivityData(LocalDate.now(), newGoal)
                        }
                    }) {
                        Text("Save", color = Trace)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showSetGoalDialog = false }) {
                        Text("Cancel", color = TextSecondary)
                    }
                }
            )
        }
    }
}
