package com.evgarct.form.ui.workout

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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.ExpandLess
import androidx.compose.material.icons.rounded.ExpandMore
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.evgarct.form.R
import com.evgarct.form.data.models.DraftExercise
import com.evgarct.form.data.models.DraftSet
import com.evgarct.form.data.models.MuscleVolumeWeek
import com.evgarct.form.data.models.RecentWorkoutSession
import com.evgarct.form.data.models.WorkoutTemplate
import com.evgarct.form.data.models.WorkoutDraft
import com.evgarct.form.data.workout.recordableSetCount
import com.evgarct.form.data.workout.repsHint
import com.evgarct.form.data.workout.tonnageKg
import com.evgarct.form.ui.nutrition.components.SelectAllOnFocusTextField
import kotlinx.coroutines.delay
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun WorkoutScreen(viewModel: WorkoutViewModel = viewModel()) {
    LaunchedEffect(Unit) { viewModel.refresh() }

    var showPicker by remember { mutableStateOf(false) }
    var confirmDiscard by remember { mutableStateOf(false) }
    var showSaveTemplate by remember { mutableStateOf(false) }
    var showFeedback by remember { mutableStateOf(false) }
    var nothingLogged by remember { mutableStateOf(false) }

    val draft = viewModel.draft
    Box(modifier = Modifier.fillMaxSize().imePadding()) {
        if (draft == null) {
            IdleContent(viewModel)
        } else {
            ActiveContent(
                draft = draft,
                viewModel = viewModel,
                nothingLogged = nothingLogged,
                onAddExercise = { showPicker = true },
                onFinish = {
                    // Nothing marked done: say so; otherwise ask for feedback first, then upload.
                    nothingLogged = draft.recordableSetCount() == 0
                    showFeedback = !nothingLogged
                },
                onSaveTemplate = { showSaveTemplate = true },
                templateMessage = viewModel.templateMessage,
                onMessageShown = viewModel::dismissTemplateMessage,
                onDiscard = { confirmDiscard = true }
            )
        }
    }

    if (showPicker) {
        ExercisePickerSheet(
            onDismiss = { showPicker = false },
            onSelect = { exercise ->
                viewModel.addExercise(exercise)
                showPicker = false
            }
        )
    }

    if (showFeedback) {
        FinishFeedbackSheet(
            onDismiss = { showFeedback = false },
            onConfirm = { feedback ->
                showFeedback = false
                viewModel.finish(feedback)
            }
        )
    }

    if (showSaveTemplate) {
        var templateName by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showSaveTemplate = false },
            title = { Text(stringResource(R.string.workout_save_template)) },
            text = {
                OutlinedTextField(
                    value = templateName,
                    onValueChange = { templateName = it },
                    singleLine = true,
                    label = { Text(stringResource(R.string.workout_template_name)) }
                )
            },
            confirmButton = {
                TextButton(
                    enabled = templateName.isNotBlank(),
                    onClick = {
                        viewModel.saveAsTemplate(templateName)
                        showSaveTemplate = false
                    }
                ) { Text(stringResource(R.string.common_save)) }
            },
            dismissButton = {
                TextButton(onClick = { showSaveTemplate = false }) { Text(stringResource(R.string.common_cancel)) }
            }
        )
    }

    if (confirmDiscard) {
        AlertDialog(
            onDismissRequest = { confirmDiscard = false },
            title = { Text(stringResource(R.string.workout_discard)) },
            text = { Text(stringResource(R.string.workout_discard_confirm)) },
            confirmButton = {
                TextButton(onClick = {
                    confirmDiscard = false
                    viewModel.discardDraft()
                }) { Text(stringResource(R.string.workout_discard), color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { confirmDiscard = false }) { Text(stringResource(R.string.common_cancel)) }
            }
        )
    }
}

@Composable
internal fun Eyebrow(text: String) {
    Text(
        text = text.uppercase(),
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 1.2.sp,
        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
    )
}

// ---------- Idle: start + history ----------

@Composable
private fun IdleContent(viewModel: WorkoutViewModel) {
    val colorScheme = MaterialTheme.colorScheme
    var pendingDelete by remember { mutableStateOf<RecentWorkoutSession?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 20.dp),
        verticalArrangement = Arrangement.spacedBy(28.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Eyebrow(stringResource(R.string.workout_eyebrow))
            Text(
                text = stringResource(R.string.workout_title),
                fontSize = 38.sp,
                fontFamily = FontFamily.Serif,
                color = colorScheme.onBackground
            )
        }

        if (viewModel.templates.isNotEmpty()) {
            TemplatesSection(
                templates = viewModel.templates,
                startingId = viewModel.startingTemplateId,
                startFailed = viewModel.templateMessage == TemplateMessage.START_FAILED,
                onStart = viewModel::startFromTemplate
            )
        }

        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            val hasTemplates = viewModel.templates.isNotEmpty()
            Button(
                onClick = viewModel::startWorkout,
                modifier = Modifier.fillMaxWidth().height(56.dp),
                shape = RoundedCornerShape(18.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (hasTemplates) colorScheme.surfaceContainerHigh else colorScheme.primaryContainer,
                    contentColor = if (hasTemplates) colorScheme.onSurface else colorScheme.onPrimaryContainer
                )
            ) {
                Text(
                    stringResource(if (hasTemplates) R.string.workout_start_empty else R.string.workout_start),
                    fontSize = 17.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
            if (!hasTemplates) {
                Text(
                    text = stringResource(R.string.workout_start_caption),
                    fontSize = 13.sp,
                    color = colorScheme.onSurfaceVariant
                )
            }
            if (viewModel.pendingCount > 0) {
                Text(
                    text = stringResource(R.string.workout_pending, viewModel.pendingCount),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = colorScheme.tertiary
                )
            }
        }

        if (viewModel.volume.isNotEmpty()) VolumeSection(viewModel.volume)

        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Eyebrow(stringResource(R.string.workout_recent))
            Spacer(Modifier.height(8.dp))
            when {
                viewModel.recent.isEmpty() && viewModel.loadFailed -> Text(
                    stringResource(R.string.workout_load_error),
                    color = colorScheme.error,
                    fontSize = 14.sp
                )
                viewModel.recent.isEmpty() && !viewModel.isLoading -> Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(stringResource(R.string.workout_empty), fontSize = 17.sp, color = colorScheme.onBackground)
                    Text(
                        stringResource(R.string.workout_empty_description),
                        fontSize = 13.sp,
                        color = colorScheme.onSurfaceVariant
                    )
                }
                else -> viewModel.recent.forEach { session ->
                    key(session.eventId) {
                        RecentSessionRow(session = session, onDelete = { pendingDelete = session })
                    }
                }
            }
        }
    }

    pendingDelete?.let { session ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text(stringResource(R.string.workout_delete)) },
            text = { Text(stringResource(R.string.workout_delete_confirm)) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteSession(session.eventId)
                    pendingDelete = null
                }) { Text(stringResource(R.string.workout_delete), color = colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { pendingDelete = null }) { Text(stringResource(R.string.common_cancel)) }
            }
        )
    }
}

@Composable
internal fun TemplatesSection(
    templates: List<WorkoutTemplate>,
    startingId: String?,
    startFailed: Boolean,
    onStart: (String) -> Unit
) {
    val colorScheme = MaterialTheme.colorScheme
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Eyebrow(stringResource(R.string.workout_templates_title))
        if (startFailed) {
            Text(stringResource(R.string.workout_template_start_error), fontSize = 13.sp, color = colorScheme.error)
        }
        templates.forEach { template ->
            key(template.id) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(20.dp))
                            .background(colorScheme.primaryContainer)
                            .clickable(enabled = startingId == null) { onStart(template.id) }
                            .padding(horizontal = 18.dp, vertical = 18.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text(template.name, fontSize = 19.sp, fontWeight = FontWeight.SemiBold, color = colorScheme.onPrimaryContainer)
                            Text(
                                stringResource(R.string.workout_template_exercises, template.exercises.size),
                                fontSize = 13.sp,
                                color = colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                            )
                        }
                        if (startingId == template.id) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Rounded.PlayArrow, contentDescription = null, tint = colorScheme.onPrimaryContainer)
                        }
                    }
                }
            }
        }
    }
}

@Composable
internal fun VolumeSection(weeks: List<MuscleVolumeWeek>) {
    val colorScheme = MaterialTheme.colorScheme
    val current = weeks.firstOrNull() ?: return
    val previous = weeks.getOrNull(1)
    val rows = current.sets.entries.sortedByDescending { it.value }
    // One shared scale for both weeks so the last-week tick is comparable with the bar.
    val scale = maxOf(1.0, current.sets.values.maxOrNull() ?: 0.0, previous?.sets?.values?.maxOrNull() ?: 0.0)

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Eyebrow(stringResource(R.string.workout_volume_title))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                stringResource(R.string.workout_volume_this_week),
                fontSize = 17.sp,
                color = colorScheme.onBackground,
                modifier = Modifier.weight(1f)
            )
            if (previous != null && previous.totalSets > 0) {
                Text(
                    stringResource(R.string.workout_volume_last_week, formatNumber(previous.totalSets)),
                    fontSize = 13.sp,
                    color = colorScheme.onSurfaceVariant
                )
            }
        }
        if (rows.isEmpty()) {
            Text(stringResource(R.string.workout_volume_empty), fontSize = 13.sp, color = colorScheme.onSurfaceVariant)
        } else {
            rows.forEach { (muscle, value) ->
                key(muscle) {
                    val before = previous?.sets?.get(muscle) ?: 0.0
                    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(muscleLabel(muscle), fontSize = 15.sp, color = colorScheme.onBackground, modifier = Modifier.weight(1f))
                            Text(
                                formatNumber(value),
                                fontSize = 15.sp,
                                fontWeight = FontWeight.SemiBold,
                                style = TextStyle(fontFeatureSettings = "tnum"),
                                color = colorScheme.onBackground
                            )
                        }
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp)
                                .clip(RoundedCornerShape(3.dp))
                                .background(colorScheme.surfaceContainerHighest)
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth((value / scale).toFloat().coerceIn(0.02f, 1f))
                                    .fillMaxHeight()
                                    .background(colorScheme.primary)
                            )
                            if (before > 0) {
                                Box(
                                    modifier = Modifier.fillMaxWidth((before / scale).toFloat().coerceIn(0.02f, 1f)).fillMaxHeight(),
                                    contentAlignment = Alignment.CenterEnd
                                ) {
                                    Box(modifier = Modifier.width(2.dp).fillMaxHeight().background(colorScheme.onSurfaceVariant))
                                }
                            }
                        }
                    }
                }
            }
            Text(stringResource(R.string.workout_volume_caption), fontSize = 12.sp, color = colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
internal fun RecentSessionRow(session: RecentWorkoutSession, onDelete: () -> Unit) {
    val colorScheme = MaterialTheme.colorScheme
    var expanded by remember { mutableStateOf(false) }
    val date = remember(session.occurredAt) { formatSessionDate(session.occurredAt, session.timezone) }

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { expanded = !expanded }
                .padding(vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(date, fontSize = 17.sp, color = colorScheme.onBackground)
                feedbackLine(session.exertion, session.mood)?.let {
                    Text(it, fontSize = 13.sp, color = colorScheme.onSurfaceVariant)
                }
                Text(
                    session.muscleGroups.map { muscleLabel(it) }.joinToString(" · "),
                    fontSize = 13.sp,
                    color = colorScheme.onSurfaceVariant
                )
                Text(
                    stringResource(
                        R.string.workout_summary,
                        session.summary.exerciseCount,
                        session.summary.setCount,
                        formatNumber(session.summary.tonnageKg)
                    ),
                    fontSize = 13.sp,
                    style = TextStyle(fontFeatureSettings = "tnum"),
                    color = colorScheme.onSurfaceVariant
                )
            }
            Icon(
                imageVector = if (expanded) Icons.Rounded.ExpandLess else Icons.Rounded.ExpandMore,
                contentDescription = null,
                tint = colorScheme.onSurfaceVariant
            )
        }

        if (expanded) {
            Column(
                modifier = Modifier.padding(bottom = 12.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                session.note?.takeIf { it.isNotBlank() }?.let {
                    Text(it, fontSize = 14.sp, color = colorScheme.onBackground)
                }
                session.exercises.forEach { exercise ->
                    key(exercise.exerciseId) {
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(exercise.name, fontSize = 15.sp, fontWeight = FontWeight.Medium, color = colorScheme.onBackground)
                            Text(
                                exercise.sets.joinToString("  ") { set ->
                                    val load = "${formatNumber(set.weightKg)}×${set.reps ?: 0}"
                                    val tags = buildString {
                                        if (set.setType == "warmup") append(" W")
                                        if (set.setType == "drop") append(" D")
                                        if (set.rir != null) append(" @${set.rir}")
                                    }
                                    load + tags
                                },
                                fontSize = 13.sp,
                                style = TextStyle(fontFeatureSettings = "tnum"),
                                color = colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
                TextButton(onClick = onDelete, contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)) {
                    Text(stringResource(R.string.workout_delete), color = colorScheme.error, fontSize = 13.sp)
                }
            }
        }
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(colorScheme.outlineVariant.copy(alpha = 0.5f)))
    }
}

// ---------- formatting ----------

internal fun formatNumber(value: Double?, blankWhenNull: Boolean = false): String {
    if (value == null) return if (blankWhenNull) "" else "0"
    return if (value % 1.0 == 0.0) value.toLong().toString() else String.format(Locale.US, "%.1f", value).trimEnd('0').trimEnd('.')
}

internal fun formatDuration(totalSeconds: Long): String {
    val seconds = totalSeconds.coerceAtLeast(0)
    val hours = seconds / 3600
    val minutes = (seconds % 3600) / 60
    val rest = seconds % 60
    return if (hours > 0) String.format(Locale.US, "%d:%02d:%02d", hours, minutes, rest)
    else String.format(Locale.US, "%d:%02d", minutes, rest)
}

private fun formatSessionDate(occurredAt: String, timezone: String): String = try {
    val zone = ZoneId.of(timezone)
    DateTimeFormatter.ofPattern("EEE, d MMM", Locale.getDefault()).format(Instant.parse(occurredAt).atZone(zone))
} catch (e: Exception) {
    occurredAt.take(10)
}
