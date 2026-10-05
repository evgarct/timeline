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
import com.evgarct.form.data.workout.tonnageKg
import com.evgarct.form.ui.nutrition.components.SelectAllOnFocusTextField
import kotlinx.coroutines.delay
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val rirCycle = listOf<Int?>(null, 4, 3, 2, 1, 0)

@Composable
fun WorkoutScreen(viewModel: WorkoutViewModel = viewModel()) {
    LaunchedEffect(Unit) { viewModel.refresh() }

    var showPicker by remember { mutableStateOf(false) }
    var confirmDiscard by remember { mutableStateOf(false) }
    var showSaveTemplate by remember { mutableStateOf(false) }
    var nothingLogged by remember { mutableStateOf(false) }

    val draft = viewModel.draft
    Box(modifier = Modifier.fillMaxSize().statusBarsPadding().imePadding()) {
        if (draft == null) {
            IdleContent(viewModel)
        } else {
            ActiveContent(
                draft = draft,
                viewModel = viewModel,
                nothingLogged = nothingLogged,
                onAddExercise = { showPicker = true },
                onFinish = { nothingLogged = viewModel.finish() == FinishOutcome.NOTHING_LOGGED },
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
private fun Eyebrow(text: String) {
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

        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(
                onClick = viewModel::startWorkout,
                modifier = Modifier.fillMaxWidth().height(56.dp),
                shape = RoundedCornerShape(18.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = colorScheme.primaryContainer,
                    contentColor = colorScheme.onPrimaryContainer
                )
            ) {
                Text(stringResource(R.string.workout_start), fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
            }
            Text(
                text = stringResource(R.string.workout_start_caption),
                fontSize = 13.sp,
                color = colorScheme.onSurfaceVariant
            )
            if (viewModel.pendingCount > 0) {
                Text(
                    text = stringResource(R.string.workout_pending, viewModel.pendingCount),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = colorScheme.tertiary
                )
            }
        }

        if (viewModel.templates.isNotEmpty()) {
            TemplatesSection(
                templates = viewModel.templates,
                startingId = viewModel.startingTemplateId,
                startFailed = viewModel.templateMessage == TemplateMessage.START_FAILED,
                onStart = viewModel::startFromTemplate
            )
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
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Eyebrow(stringResource(R.string.workout_templates_title))
        Spacer(Modifier.height(8.dp))
        if (startFailed) {
            Text(stringResource(R.string.workout_template_start_error), fontSize = 13.sp, color = colorScheme.error)
        }
        templates.forEach { template ->
            key(template.id) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable(enabled = startingId == null) { onStart(template.id) }
                            .padding(vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text(template.name, fontSize = 17.sp, color = colorScheme.onBackground)
                            Text(
                                stringResource(R.string.workout_template_exercises, template.exercises.size),
                                fontSize = 13.sp,
                                color = colorScheme.onSurfaceVariant
                            )
                        }
                        if (startingId == template.id) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Rounded.PlayArrow, contentDescription = null, tint = colorScheme.primary)
                        }
                    }
                    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(colorScheme.outlineVariant.copy(alpha = 0.5f)))
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

// ---------- Active session ----------

@Composable
private fun ActiveContent(
    draft: WorkoutDraft,
    viewModel: WorkoutViewModel,
    nothingLogged: Boolean,
    onAddExercise: () -> Unit,
    onFinish: () -> Unit,
    onSaveTemplate: () -> Unit,
    templateMessage: TemplateMessage?,
    onMessageShown: () -> Unit,
    onDiscard: () -> Unit
) {
    val colorScheme = MaterialTheme.colorScheme
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            now = System.currentTimeMillis()
            delay(1000)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Eyebrow(stringResource(R.string.workout_title))
                Text(
                    text = formatDuration((now - draft.startedAtMillis) / 1000),
                    fontSize = 34.sp,
                    fontFamily = FontFamily.Serif,
                    color = colorScheme.onBackground
                )
                Text(
                    text = stringResource(R.string.workout_live_summary, draft.recordableSetCount(), formatNumber(draft.tonnageKg())),
                    fontSize = 13.sp,
                    style = TextStyle(fontFeatureSettings = "tnum"),
                    color = colorScheme.onSurfaceVariant
                )
            }
            Button(
                onClick = onFinish,
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = colorScheme.primary,
                    contentColor = colorScheme.onPrimary
                )
            ) { Text(stringResource(R.string.workout_finish), fontWeight = FontWeight.SemiBold, color = colorScheme.onPrimary) }
        }

        if (nothingLogged) {
            Text(stringResource(R.string.workout_nothing_logged), fontSize = 13.sp, color = colorScheme.error)
        }

        val restEnds = viewModel.restEndsAtMillis
        if (restEnds != null) {
            val remaining = (restEnds - now) / 1000
            if (remaining > 0) {
                RestBar(
                    remainingSeconds = remaining,
                    onSkip = viewModel::skipRest,
                    onAdjust = viewModel::adjustRest
                )
            } else {
                LaunchedEffect(restEnds) { viewModel.skipRest() }
            }
        }

        draft.exercises.forEachIndexed { index, exercise ->
            key(exercise.exerciseId) {
                ExerciseBlock(
                    exercise = exercise,
                    isLast = index == draft.exercises.lastIndex,
                    isLinkedToNext = exercise.sets.firstOrNull()?.groupId != null &&
                        exercise.sets.firstOrNull()?.groupId == draft.exercises.getOrNull(index + 1)?.sets?.firstOrNull()?.groupId,
                    viewModel = viewModel,
                    onToggleSuperset = { viewModel.toggleSupersetWithNext(index) }
                )
            }
        }

        FilledTonalButton(
            onClick = onAddExercise,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(16.dp)
        ) {
            Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
            Text(stringResource(R.string.workout_add_exercise), fontWeight = FontWeight.Medium)
        }

        templateMessage?.takeIf { it != TemplateMessage.START_FAILED }?.let { message ->
            LaunchedEffect(message) {
                delay(3000)
                onMessageShown()
            }
            Text(
                text = stringResource(
                    if (message == TemplateMessage.SAVED) R.string.workout_template_saved else R.string.workout_template_save_error
                ),
                fontSize = 13.sp,
                color = if (message == TemplateMessage.SAVED) colorScheme.primary else colorScheme.error,
                modifier = Modifier.align(Alignment.CenterHorizontally)
            )
        }

        TextButton(onClick = onSaveTemplate, modifier = Modifier.align(Alignment.CenterHorizontally)) {
            Text(stringResource(R.string.workout_save_template), fontSize = 14.sp)
        }

        TextButton(onClick = onDiscard, modifier = Modifier.align(Alignment.CenterHorizontally)) {
            Text(stringResource(R.string.workout_discard), color = colorScheme.error, fontSize = 14.sp)
        }
        Spacer(Modifier.height(16.dp))
    }
}

@Composable
private fun RestBar(remainingSeconds: Long, onSkip: () -> Unit, onAdjust: (Int) -> Unit) {
    val colorScheme = MaterialTheme.colorScheme
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(colorScheme.secondaryContainer)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                stringResource(R.string.workout_rest).uppercase(),
                fontSize = 11.sp,
                letterSpacing = 1.2.sp,
                color = colorScheme.onSecondaryContainer.copy(alpha = 0.7f)
            )
            Text(
                formatDuration(remainingSeconds),
                fontSize = 24.sp,
                style = TextStyle(fontFeatureSettings = "tnum"),
                color = colorScheme.onSecondaryContainer
            )
        }
        TextButton(onClick = { onAdjust(-15) }) { Text("−15", color = colorScheme.onSecondaryContainer) }
        TextButton(onClick = { onAdjust(15) }) { Text("+15", color = colorScheme.onSecondaryContainer) }
        TextButton(onClick = onSkip) {
            Text(stringResource(R.string.workout_rest_skip), color = colorScheme.onSecondaryContainer, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun ExerciseBlock(
    exercise: DraftExercise,
    isLast: Boolean,
    isLinkedToNext: Boolean,
    viewModel: WorkoutViewModel,
    onToggleSuperset: () -> Unit
) {
    val colorScheme = MaterialTheme.colorScheme
    var menuOpen by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(22.dp))
            .background(colorScheme.surfaceContainer)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Row(verticalAlignment = Alignment.Top) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(exercise.name, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = colorScheme.onSurface)
                prescriptionLabel(exercise)?.let {
                    Text(it, fontSize = 14.sp, fontWeight = FontWeight.Medium, color = colorScheme.primary)
                }
                val meta = listOfNotNull(
                    exercise.lastTopWeightKg?.let { stringResource(R.string.workout_last, formatNumber(it)) },
                    exercise.bestE1rmKg?.let { stringResource(R.string.workout_e1rm, formatNumber(it)) }
                ).joinToString(" · ")
                if (meta.isNotEmpty()) Text(meta, fontSize = 13.sp, color = colorScheme.onSurfaceVariant)
                exercise.suggestedWeightKg?.let {
                    Text(
                        stringResource(R.string.workout_suggested, formatNumber(it)),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = colorScheme.onSurface
                    )
                }
                if (isLinkedToNext) {
                    Text(stringResource(R.string.workout_superset), fontSize = 12.sp, color = colorScheme.tertiary)
                }
            }
            Box {
                Icon(
                    Icons.Rounded.MoreVert,
                    contentDescription = null,
                    tint = colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(24.dp).clickable { menuOpen = true }
                )
                DropdownMenu(
                    expanded = menuOpen,
                    onDismissRequest = { menuOpen = false },
                    containerColor = colorScheme.surfaceContainerHighest
                ) {
                    if (!isLast) {
                        DropdownMenuItem(
                            text = {
                                Text(stringResource(if (isLinkedToNext) R.string.workout_unlink else R.string.workout_superset))
                            },
                            onClick = {
                                menuOpen = false
                                onToggleSuperset()
                            }
                        )
                    }
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.workout_remove_exercise), color = colorScheme.error) },
                        onClick = {
                            menuOpen = false
                            viewModel.removeExercise(exercise.exerciseId)
                        }
                    )
                }
            }
        }

        SetHeader()
        exercise.sets.forEachIndexed { index, set ->
            key(set.id) {
                SetRow(
                    number = index + 1,
                    set = set,
                    onChange = { change -> viewModel.updateSet(exercise.exerciseId, set.id, change) },
                    onToggleDone = { viewModel.toggleDone(exercise.exerciseId, set.id) },
                    onRemove = { viewModel.removeSet(exercise.exerciseId, set.id) }
                )
            }
        }

        TextButton(onClick = { viewModel.addSet(exercise.exerciseId) }, modifier = Modifier.align(Alignment.Start)) {
            Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text(stringResource(R.string.workout_add_set))
        }
    }
}

/** "3 × 6–10 · RIR 2" for exercises that came from a template; null for ad-hoc ones. */
@Composable
private fun prescriptionLabel(exercise: DraftExercise): String? {
    val min = exercise.repMin
    val max = exercise.repMax
    val range = when {
        min != null && max != null && min != max -> "$min–$max"
        else -> (max ?: min)?.toString()
    }
    val target = range?.let { "${exercise.sets.size} × $it" }
    val rir = exercise.targetRir?.let { stringResource(R.string.workout_target_rir, it) }
    return listOfNotNull(target, rir).joinToString(" · ").ifEmpty { null }
}

@Composable
private fun SetHeader() {
    val color = MaterialTheme.colorScheme.onSurfaceVariant
    val style = TextStyle(fontSize = 11.sp, letterSpacing = 1.sp, color = color, textAlign = TextAlign.Center)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Spacer(Modifier.width(36.dp))
        Text(stringResource(R.string.workout_kg).uppercase(), style = style, modifier = Modifier.weight(1f))
        Text(stringResource(R.string.workout_reps).uppercase(), style = style, modifier = Modifier.weight(1f))
        Text(stringResource(R.string.workout_rir), style = style, modifier = Modifier.width(48.dp))
        Spacer(Modifier.width(40.dp))
    }
}

@Composable
private fun SetRow(
    number: Int,
    set: DraftSet,
    onChange: ((DraftSet) -> DraftSet) -> Unit,
    onToggleDone: () -> Unit,
    onRemove: () -> Unit
) {
    val colorScheme = MaterialTheme.colorScheme
    // Local text state per field: the draft stores parsed numbers, but a half-typed "8." must stay
    // as typed instead of being rewritten to "8" on every keystroke.
    var weightText by remember(set.id) { mutableStateOf(formatNumber(set.weightKg, blankWhenNull = true)) }
    var repsText by remember(set.id) { mutableStateOf(set.reps?.toString() ?: "") }
    var typeMenu by remember { mutableStateOf(false) }

    // A weight prefilled from history arrives after the row was first composed.
    LaunchedEffect(set.weightKg) {
        val current = weightText.replace(',', '.').toDoubleOrNull()
        if (current != set.weightKg && !(weightText.isBlank() && set.weightKg == null)) {
            weightText = formatNumber(set.weightKg, blankWhenNull = true)
        }
    }

    val fieldStyle = TextStyle(
        fontSize = 18.sp,
        fontFeatureSettings = "tnum",
        color = colorScheme.onSurface,
        textAlign = TextAlign.Center
    )
    val rowBackground = if (set.done) colorScheme.primaryContainer.copy(alpha = 0.45f) else colorScheme.surfaceContainerHigh.copy(alpha = 0f)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(rowBackground),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(modifier = Modifier.width(36.dp), contentAlignment = Alignment.Center) {
            val label = when (set.setType) {
                "warmup" -> "W"
                "drop" -> "D"
                else -> number.toString()
            }
            Text(
                text = label,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (set.setType == "working") colorScheme.onSurfaceVariant else colorScheme.tertiary,
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .clickable { typeMenu = true }
                    .wrapContentHeight(Alignment.CenterVertically),
                textAlign = TextAlign.Center
            )
            DropdownMenu(
                expanded = typeMenu,
                onDismissRequest = { typeMenu = false },
                containerColor = colorScheme.surfaceContainerHighest
            ) {
                listOf(
                    "working" to R.string.workout_set_working,
                    "warmup" to R.string.workout_set_warmup,
                    "drop" to R.string.workout_set_drop
                ).forEach { (type, label) ->
                    DropdownMenuItem(
                        text = { Text(stringResource(label)) },
                        onClick = {
                            typeMenu = false
                            onChange { it.copy(setType = type) }
                        }
                    )
                }
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.workout_remove_set), color = colorScheme.error) },
                    onClick = {
                        typeMenu = false
                        onRemove()
                    }
                )
            }
        }

        NumberField(
            value = weightText,
            onValueChange = { text ->
                weightText = text
                onChange { it.copy(weightKg = text.replace(',', '.').toDoubleOrNull()) }
            },
            keyboardType = KeyboardType.Decimal,
            textStyle = fieldStyle,
            modifier = Modifier.weight(1f)
        )
        NumberField(
            value = repsText,
            onValueChange = { text ->
                val digits = text.filter { it.isDigit() }.take(3)
                repsText = digits
                onChange { it.copy(reps = digits.toIntOrNull()) }
            },
            keyboardType = KeyboardType.Number,
            textStyle = fieldStyle,
            modifier = Modifier.weight(1f)
        )

        Text(
            text = set.rir?.toString() ?: "–",
            fontSize = 16.sp,
            style = TextStyle(fontFeatureSettings = "tnum"),
            textAlign = TextAlign.Center,
            color = if (set.rir == null) colorScheme.onSurfaceVariant else colorScheme.onSurface,
            modifier = Modifier
                .width(48.dp)
                .height(44.dp)
                .clip(RoundedCornerShape(12.dp))
                .clickable {
                    val next = rirCycle[(rirCycle.indexOf(set.rir) + 1) % rirCycle.size]
                    onChange { it.copy(rir = next) }
                }
                .wrapContentHeight(Alignment.CenterVertically)
        )

        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(if (set.done) colorScheme.primary else colorScheme.surfaceContainerHighest)
                .clickable(onClick = onToggleDone),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                Icons.Rounded.Check,
                contentDescription = stringResource(R.string.workout_set_done),
                tint = if (set.done) colorScheme.onPrimary else colorScheme.onSurfaceVariant,
                modifier = Modifier.size(22.dp)
            )
        }
    }
}

@Composable
private fun NumberField(
    value: String,
    onValueChange: (String) -> Unit,
    keyboardType: KeyboardType,
    textStyle: TextStyle,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .height(44.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHighest),
        contentAlignment = Alignment.Center
    ) {
        SelectAllOnFocusTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 6.dp),
            textStyle = textStyle,
            cursorColor = MaterialTheme.colorScheme.primary,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType)
        )
    }
}

// ---------- formatting ----------

private fun formatNumber(value: Double?, blankWhenNull: Boolean = false): String {
    if (value == null) return if (blankWhenNull) "" else "0"
    return if (value % 1.0 == 0.0) value.toLong().toString() else String.format(Locale.US, "%.1f", value).trimEnd('0').trimEnd('.')
}

private fun formatDuration(totalSeconds: Long): String {
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
