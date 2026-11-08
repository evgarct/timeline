package com.evgarct.form.ui.workout

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.SubcomposeAsyncImage
import com.evgarct.form.R
import com.evgarct.form.data.models.PlannedExerciseDto
import com.evgarct.form.data.models.TemplatePlan

/**
 * What a template holds, shown before anything starts: opening the Train tab to look at the list of
 * exercises must not begin a workout (and its clock). Only the Start button does.
 */
@Composable
internal fun TemplatePreview(plan: TemplatePlan, onBack: () -> Unit, onStart: () -> Unit) {
    val colorScheme = MaterialTheme.colorScheme
    BackHandler(onBack = onBack)
    Column(modifier = Modifier.fillMaxSize().statusBarsPadding().testTag("template_preview")) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 8.dp, end = 20.dp, top = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier.size(44.dp).clip(CircleShape).clickable(onClick = onBack),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.AutoMirrored.Rounded.ArrowBack,
                    contentDescription = stringResource(R.string.common_close),
                    tint = colorScheme.onBackground
                )
            }
            Text(
                plan.name,
                fontSize = 26.sp,
                fontFamily = FontFamily.Serif,
                color = colorScheme.onBackground,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f).padding(start = 4.dp)
            )
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            plan.note?.takeIf { it.isNotBlank() }?.let { CoachNote(it) }
            plan.exercises.forEach { exercise -> PreviewExerciseRow(exercise) }
        }

        Button(
            onClick = onStart,
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp, vertical = 12.dp)
                .height(56.dp)
                .testTag("template_start"),
            shape = RoundedCornerShape(18.dp)
        ) {
            Text(stringResource(R.string.workout_start), fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun PreviewExerciseRow(exercise: PlannedExerciseDto) {
    val colorScheme = MaterialTheme.colorScheme
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(colorScheme.surfaceContainer)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            val photo = exercise.images.firstOrNull()
            if (photo != null) {
                SubcomposeAsyncImage(
                    model = photo,
                    contentDescription = exercise.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .size(64.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(colorScheme.surfaceContainerHigh),
                    error = {}
                )
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(exercise.name, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = colorScheme.onSurface)
                Text(prescription(exercise), fontSize = 13.sp, color = colorScheme.onSurfaceVariant)
            }
        }
        exercise.note?.takeIf { it.isNotBlank() }?.let { CoachNote(it) }
        if (exercise.alternatives.isNotEmpty()) {
            Text(
                stringResource(R.string.workout_alternatives_line, exercise.alternatives.joinToString(", ") { it.name }),
                fontSize = 12.sp,
                color = colorScheme.onSurfaceVariant
            )
        }
    }
}

/** "3 × 6–10 · 40 kg": the sets, the rep range and the suggested load, whichever are known. */
@Composable
private fun prescription(exercise: PlannedExerciseDto): String {
    val reps = when {
        exercise.repMin != null && exercise.repMax != null && exercise.repMin != exercise.repMax -> "${exercise.repMin}–${exercise.repMax}"
        exercise.repMax != null -> "${exercise.repMax}"
        exercise.repMin != null -> "${exercise.repMin}"
        else -> null
    }
    val weight = exercise.suggestion.weightKg?.let { "${formatNumber(it)} ${stringResource(R.string.workout_kg)}" }
    return listOfNotNull(if (reps != null) "${exercise.sets} × $reps" else "${exercise.sets}", weight).joinToString(" · ")
}
