package com.evgarct.form.ui.workout

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
import androidx.compose.foundation.layout.navigationBarsPadding
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
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.Text
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.SubcomposeAsyncImage
import com.evgarct.form.R
import com.evgarct.form.data.models.DraftExercise
import com.evgarct.form.data.models.DraftSet
import com.evgarct.form.data.models.WorkoutDraft
import com.evgarct.form.data.workout.recordableSetCount
import com.evgarct.form.data.workout.repsHint
import com.evgarct.form.data.workout.tonnageKg
import com.evgarct.form.ui.nutrition.components.SelectAllOnFocusTextField
import kotlinx.coroutines.delay
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val rirCycle = listOf<Int?>(null, 4, 3, 2, 1, 0)

private val NUMBER_COLUMN = 30.dp
private val CHECK_COLUMN = 36.dp
private val COLUMN_GAP = 6.dp

/** Consecutive exercises that share a superset id are shown inside one container; everything else stands alone. */
internal fun List<DraftExercise>.groupedForDisplay(): List<List<DraftExercise>> {
    val result = mutableListOf<MutableList<DraftExercise>>()
    forEach { exercise ->
        val group = exercise.sets.firstOrNull()?.groupId
        val last = result.lastOrNull()
        if (group != null && last != null && last.first().sets.firstOrNull()?.groupId == group) {
            last += exercise
        } else {
            result += mutableListOf(exercise)
        }
    }
    return result
}

@Composable
internal fun ActiveContent(
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
    var detail by remember { mutableStateOf<DraftExercise?>(null) }

    Column(modifier = Modifier.fillMaxSize()) {
        WorkoutHeader(
            draft = draft,
            elapsedSeconds = (now - draft.startedAtMillis) / 1000,
            onSaveTemplate = onSaveTemplate,
            onDiscard = onDiscard
        )

        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            val exercises = draft.exercises
            exercises.groupedForDisplay().forEach { group ->
                key(group.first().exerciseId) {
                    if (group.size > 1) {
                        SupersetGroup(label = group.firstNotNullOfOrNull { it.groupLabel }) {
                            group.forEach { exercise ->
                                key(exercise.exerciseId) {
                                    ExerciseCard(
                                        exercise = exercise,
                                        index = exercises.indexOfFirst { it.exerciseId == exercise.exerciseId },
                                        count = exercises.size,
                                        viewModel = viewModel,
                                        onOpenDetail = { detail = exercise }
                                    )
                                }
                            }
                        }
                    } else {
                        val exercise = group.first()
                        ExerciseCard(
                            exercise = exercise,
                            index = exercises.indexOfFirst { it.exerciseId == exercise.exerciseId },
                            count = exercises.size,
                            viewModel = viewModel,
                            onOpenDetail = { detail = exercise }
                        )
                    }
                }
            }

            FilledTonalButton(
                onClick = onAddExercise,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(18.dp)
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
        }

        BottomFinishBar(draft = draft, nothingLogged = nothingLogged, onFinish = onFinish)
    }

    detail?.let { shown ->
        // Re-read from the draft so the sheet never shows a stale copy after edits.
        val current = draft.exercises.firstOrNull { it.exerciseId == shown.exerciseId } ?: shown
        ExerciseDetailSheet(exercise = current, onDismiss = { detail = null })
    }
}

/** Same language as the idle screen: small caps eyebrow, serif title, no extra surfaces. */
@Composable
private fun WorkoutHeader(
    draft: WorkoutDraft,
    elapsedSeconds: Long,
    onSaveTemplate: () -> Unit,
    onDiscard: () -> Unit
) {
    val colorScheme = MaterialTheme.colorScheme
    var menuOpen by remember { mutableStateOf(false) }
    val date = remember(draft.startedAtMillis) {
        formatHeaderDate(Instant.ofEpochMilli(draft.startedAtMillis).atZone(ZoneId.systemDefault()).toLocalDate())
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .statusBarsPadding()
            .padding(start = 24.dp, end = 12.dp, top = 12.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Eyebrow(date)
            Text(
                text = draft.title ?: stringResource(R.string.workout_title),
                fontSize = 30.sp,
                fontFamily = FontFamily.Serif,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                color = colorScheme.onBackground
            )
        }
        Text(
            text = formatDuration(elapsedSeconds),
            fontSize = 17.sp,
            fontWeight = FontWeight.Medium,
            style = TextStyle(fontFeatureSettings = "tnum"),
            color = colorScheme.onSurfaceVariant
        )
        Box {
            Box(
                modifier = Modifier.size(48.dp).clip(CircleShape).clickable { menuOpen = true },
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Rounded.MoreVert, contentDescription = stringResource(R.string.workout_more), tint = colorScheme.onSurfaceVariant)
            }
            DropdownMenu(
                expanded = menuOpen,
                onDismissRequest = { menuOpen = false },
                containerColor = colorScheme.surfaceContainerHighest
            ) {
                DropdownMenuItem(
                    colors = com.evgarct.form.core.theme.formMenuItemColors(),
                    text = { Text(stringResource(R.string.workout_save_template)) },
                    onClick = {
                        menuOpen = false
                        onSaveTemplate()
                    }
                )
                DropdownMenuItem(
                    colors = com.evgarct.form.core.theme.formMenuItemColors(),
                    text = { Text(stringResource(R.string.workout_discard), color = colorScheme.error) },
                    onClick = {
                        menuOpen = false
                        onDiscard()
                    }
                )
            }
        }
    }
}

@Composable
private fun BottomFinishBar(draft: WorkoutDraft, nothingLogged: Boolean, onFinish: () -> Unit) {
    val colorScheme = MaterialTheme.colorScheme
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(colorScheme.background)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(
            text = if (nothingLogged) stringResource(R.string.workout_nothing_logged)
            else stringResource(R.string.workout_live_summary, draft.recordableSetCount(), formatNumber(draft.tonnageKg())),
            fontSize = 13.sp,
            style = TextStyle(fontFeatureSettings = "tnum"),
            color = if (nothingLogged) colorScheme.error else colorScheme.onSurfaceVariant,
            modifier = Modifier.align(Alignment.CenterHorizontally)
        )
        Button(
            onClick = onFinish,
            modifier = Modifier.fillMaxWidth().height(56.dp),
            shape = RoundedCornerShape(18.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = colorScheme.primaryContainer,
                contentColor = colorScheme.onPrimaryContainer
            )
        ) {
            Text(stringResource(R.string.workout_finish_workout), fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

/** A small tab with the superset name on top of one shared container around the linked cards. */
@Composable
private fun SupersetGroup(label: String?, content: @Composable () -> Unit) {
    val colorScheme = MaterialTheme.colorScheme
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = label ?: stringResource(R.string.workout_superset_tab),
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = colorScheme.primary,
            modifier = Modifier
                .clip(RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp))
                .background(colorScheme.surfaceContainerHigh)
                .padding(horizontal = 14.dp, vertical = 6.dp)
        )
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(bottomStart = 24.dp, bottomEnd = 24.dp, topEnd = 24.dp))
                .background(colorScheme.surfaceContainerHigh)
                .padding(6.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            content()
        }
    }
}

@Composable
private fun ExerciseCard(
    exercise: DraftExercise,
    index: Int,
    count: Int,
    viewModel: WorkoutViewModel,
    onOpenDetail: () -> Unit
) {
    val colorScheme = MaterialTheme.colorScheme
    var menuOpen by remember { mutableStateOf(false) }
    var noteOpen by remember(exercise.exerciseId) { mutableStateOf(!exercise.note.isNullOrBlank()) }
    val allDone = exercise.sets.isNotEmpty() && exercise.sets.all { it.done }
    val draftExercises = viewModel.draft?.exercises.orEmpty()
    val isLinkedToNext = exercise.sets.firstOrNull()?.groupId.let { group ->
        group != null && group == draftExercises.getOrNull(index + 1)?.sets?.firstOrNull()?.groupId
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(colorScheme.surfaceContainer)
            .padding(start = 14.dp, end = 14.dp, top = 8.dp, bottom = 10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                exercise.name,
                fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold,
                color = colorScheme.onSurface,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )
            Box {
                Box(
                    modifier = Modifier.size(40.dp).clip(CircleShape).clickable { menuOpen = true },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Rounded.MoreVert,
                        contentDescription = stringResource(R.string.workout_more),
                        tint = colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(22.dp)
                    )
                }
                DropdownMenu(
                    expanded = menuOpen,
                    onDismissRequest = { menuOpen = false },
                    containerColor = colorScheme.surfaceContainerHighest
                ) {
                    if (index < count - 1) {
                        DropdownMenuItem(
                    colors = com.evgarct.form.core.theme.formMenuItemColors(),
                            text = { Text(stringResource(if (isLinkedToNext) R.string.workout_unlink else R.string.workout_superset)) },
                            onClick = {
                                menuOpen = false
                                viewModel.toggleSupersetWithNext(index)
                            }
                        )
                    }
                    DropdownMenuItem(
                    colors = com.evgarct.form.core.theme.formMenuItemColors(),
                        text = { Text(stringResource(R.string.workout_note_menu)) },
                        onClick = {
                            menuOpen = false
                            noteOpen = true
                        }
                    )
                    DropdownMenuItem(
                    colors = com.evgarct.form.core.theme.formMenuItemColors(),
                        text = { Text(stringResource(R.string.workout_remove_exercise), color = colorScheme.error) },
                        onClick = {
                            menuOpen = false
                            viewModel.removeExercise(exercise.exerciseId)
                        }
                    )
                }
            }
        }

        // One tile, two pictures: how the exercise looks and which muscles it works. The check next
        // to it completes every set of the exercise at once.
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            ExerciseMedia(exercise = exercise, modifier = Modifier.weight(1f), onClick = onOpenDetail)
            CheckCircle(
                done = allDone,
                size = 48.dp,
                description = stringResource(R.string.workout_exercise_done),
                onClick = { viewModel.toggleExerciseDone(exercise.exerciseId) }
            )
        }

        SetTable(exercise = exercise, viewModel = viewModel)

        if (noteOpen) {
            OutlinedTextField(
                value = exercise.note.orEmpty(),
                onValueChange = { viewModel.updateNote(exercise.exerciseId, it) },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text(stringResource(R.string.workout_note_hint)) },
                shape = RoundedCornerShape(16.dp),
                minLines = 1,
                maxLines = 4
            )
        }
    }
}

@Composable
private fun CheckCircle(done: Boolean, size: Dp, description: String, onClick: () -> Unit) {
    val colorScheme = MaterialTheme.colorScheme
    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(if (done) colorScheme.primary else colorScheme.surfaceContainerHighest)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            Icons.Rounded.Check,
            contentDescription = description,
            tint = if (done) colorScheme.onPrimary else colorScheme.onSurfaceVariant,
            modifier = Modifier.size(size * 0.55f)
        )
    }
}

/** Photo on the left, highlighted muscles on the right, both in one rounded tile; tap opens them bigger. */
@Composable
private fun ExerciseMedia(exercise: DraftExercise, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val colorScheme = MaterialTheme.colorScheme
    val height = 96.dp
    val photo = exercise.images.firstOrNull()
    Row(
        modifier = modifier
            .testTag("exercise-media")
            .height(height)
            .clip(RoundedCornerShape(18.dp))
            .background(colorScheme.surfaceContainerHighest)
            .clickable(onClick = onClick),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (photo != null) {
            SubcomposeAsyncImage(
                model = photo,
                contentDescription = exercise.name,
                contentScale = ContentScale.Crop,
                modifier = Modifier.weight(1f).fillMaxSize(),
                loading = { Box(Modifier.fillMaxSize().background(colorScheme.surfaceContainerHigh)) },
                error = { Box(Modifier.fillMaxSize().background(colorScheme.surfaceContainerHigh)) }
            )
        }
        Box(modifier = Modifier.weight(1f).fillMaxSize(), contentAlignment = Alignment.Center) {
            MuscleMap(
                primary = exercise.primaryMuscles,
                secondary = exercise.secondaryMuscles,
                modifier = Modifier.height(height - 14.dp)
            )
        }
    }
}

@Composable
private fun SetTable(exercise: DraftExercise, viewModel: WorkoutViewModel) {
    val colorScheme = MaterialTheme.colorScheme
    val headerStyle = TextStyle(fontSize = 11.sp, color = colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
    val lastHeader = exercise.lastDate?.let { formatShortDate(it) }

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(COLUMN_GAP), verticalAlignment = Alignment.Bottom) {
            Spacer(Modifier.width(NUMBER_COLUMN))
            Text(
                text = if (lastHeader != null) stringResource(R.string.workout_last_time) + "\n" + lastHeader
                else stringResource(R.string.workout_last_time),
                style = headerStyle,
                modifier = Modifier.weight(1f)
            )
            Text(stringResource(R.string.workout_kg), style = headerStyle, modifier = Modifier.weight(1f))
            Text(stringResource(R.string.workout_reps), style = headerStyle, modifier = Modifier.weight(1f))
            Spacer(Modifier.width(CHECK_COLUMN))
        }
        exercise.sets.forEachIndexed { index, set ->
            key(set.id) {
                SetRow(
                    number = index + 1,
                    set = set,
                    last = lastLabel(exercise, index),
                    repsHint = repsHint(exercise, index),
                    onChange = { change -> viewModel.updateSet(exercise.exerciseId, set.id, change) },
                    onToggleDone = { viewModel.toggleDone(exercise.exerciseId, set.id) },
                    onRemove = { viewModel.removeSet(exercise.exerciseId, set.id) }
                )
            }
        }
    }
}

@Composable
private fun SetRow(
    number: Int,
    set: DraftSet,
    last: String?,
    repsHint: Int?,
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

    // Values prefilled after the row was first composed (history arriving, the done-tap filling reps).
    LaunchedEffect(set.reps) {
        if (set.reps != null && set.reps.toString() != repsText) repsText = set.reps.toString()
    }
    LaunchedEffect(set.weightKg) {
        val current = weightText.replace(',', '.').toDoubleOrNull()
        if (current != set.weightKg && !(weightText.isBlank() && set.weightKg == null)) {
            weightText = formatNumber(set.weightKg, blankWhenNull = true)
        }
    }

    val fieldStyle = TextStyle(
        fontSize = 16.sp,
        fontFeatureSettings = "tnum",
        color = colorScheme.onSurface,
        textAlign = TextAlign.Center
    )
    val cellStyle = TextStyle(
        fontSize = 13.sp,
        fontFeatureSettings = "tnum",
        color = colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center
    )
    val rowBackground = if (set.done) colorScheme.primaryContainer.copy(alpha = 0.45f) else colorScheme.surfaceContainer

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(rowBackground),
        horizontalArrangement = Arrangement.spacedBy(COLUMN_GAP),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(modifier = Modifier.width(NUMBER_COLUMN), contentAlignment = Alignment.Center) {
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
                    .size(NUMBER_COLUMN)
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
                    colors = com.evgarct.form.core.theme.formMenuItemColors(),
                        text = { Text(stringResource(label)) },
                        onClick = {
                            typeMenu = false
                            onChange { it.copy(setType = type) }
                        }
                    )
                }
                // RIR is not on the screen, but stays recordable (and visible to the AI) from here.
                DropdownMenuItem(
                    colors = com.evgarct.form.core.theme.formMenuItemColors(),
                    text = { Text(stringResource(R.string.workout_rir_value, set.rir?.toString() ?: "–")) },
                    onClick = {
                        val next = rirCycle[(rirCycle.indexOf(set.rir) + 1) % rirCycle.size]
                        onChange { it.copy(rir = next) }
                    }
                )
                DropdownMenuItem(
                    colors = com.evgarct.form.core.theme.formMenuItemColors(),
                    text = { Text(stringResource(R.string.workout_remove_set), color = colorScheme.error) },
                    onClick = {
                        typeMenu = false
                        onRemove()
                    }
                )
            }
        }

        Text(text = last ?: "–", style = cellStyle, maxLines = 1, modifier = Modifier.weight(1f))

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
            placeholder = repsHint?.toString(),
            modifier = Modifier.weight(1f)
        )

        CheckCircle(
            done = set.done,
            size = CHECK_COLUMN,
            description = stringResource(R.string.workout_set_done),
            onClick = onToggleDone
        )
    }
}

@Composable
private fun NumberField(
    value: String,
    onValueChange: (String) -> Unit,
    keyboardType: KeyboardType,
    textStyle: TextStyle,
    modifier: Modifier = Modifier,
    placeholder: String? = null
) {
    Box(
        modifier = modifier
            .height(44.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHighest),
        contentAlignment = Alignment.Center
    ) {
        if (value.isEmpty() && placeholder != null) {
            Text(
                text = placeholder,
                style = textStyle.copy(color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.45f)),
                modifier = Modifier.fillMaxWidth()
            )
        }
        SelectAllOnFocusTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
            textStyle = textStyle,
            cursorColor = MaterialTheme.colorScheme.primary,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType)
        )
    }
}

/** The pictures only, bigger: the exercise photos and the muscle map. No text. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ExerciseDetailSheet(exercise: DraftExercise, onDismiss: () -> Unit) {
    val colorScheme = MaterialTheme.colorScheme
    // Technique text is the point of opening this: start fully expanded instead of half-height.
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = colorScheme.surfaceContainer
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(exercise.name, fontSize = 22.sp, fontFamily = FontFamily.Serif, color = colorScheme.onSurface)
            if (exercise.images.isNotEmpty()) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    exercise.images.take(2).forEach { url ->
                        SubcomposeAsyncImage(
                            model = url,
                            contentDescription = exercise.name,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .weight(1f)
                                .height(160.dp)
                                .clip(RoundedCornerShape(18.dp))
                                .background(colorScheme.surfaceContainerHigh),
                            error = {}
                        )
                    }
                }
            }
            if (exercise.instructions.isNotEmpty()) {
                Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Eyebrow(stringResource(R.string.workout_technique))
                    exercise.instructions.forEachIndexed { index, step ->
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text(
                                text = "${index + 1}",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = colorScheme.primary,
                                modifier = Modifier.width(18.dp)
                            )
                            Text(text = step, fontSize = 15.sp, lineHeight = 21.sp, color = colorScheme.onSurface)
                        }
                    }
                }
            }
            MuscleMap(
                primary = exercise.primaryMuscles,
                secondary = exercise.secondaryMuscles,
                modifier = Modifier.height(180.dp)
            )
        }
    }
}

/** The last-time cell for set [index]: "10×12" (weight × reps), falling back to whichever half is known. */
internal fun lastLabel(exercise: DraftExercise, index: Int): String? {
    val last = exercise.lastSets.getOrNull(index) ?: return null
    return when {
        last.weightKg != null && last.reps != null -> "${formatNumber(last.weightKg)}×${last.reps}"
        last.weightKg != null -> formatNumber(last.weightKg)
        last.reps != null -> "×${last.reps}"
        else -> null
    }
}

/** "2026-10-05" -> "5.10" (day.month). */
internal fun formatShortDate(isoDate: String): String = try {
    LocalDate.parse(isoDate.take(10)).format(DateTimeFormatter.ofPattern("d.MM"))
} catch (e: Exception) {
    isoDate.take(10)
}

private fun formatHeaderDate(date: LocalDate): String =
    DateTimeFormatter.ofPattern("EEE, d MMM", Locale.getDefault()).format(date)
