package com.evgarct.form.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.SubcomposeAsyncImage
import com.evgarct.form.R
import com.evgarct.form.data.models.AlternativeExercise
import com.evgarct.form.data.models.DraftExercise
import com.evgarct.form.data.models.Exercise

/**
 * "Replace" for an exercise in the active workout: the alternatives the agent put into the template come first
 * (one tap), anything else goes through the regular exercise picker. Without alternatives it opens the picker directly.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ReplaceExerciseSheet(
    exercise: DraftExercise,
    onDismiss: () -> Unit,
    onAlternative: (AlternativeExercise) -> Unit,
    onPick: (Exercise) -> Unit
) {
    var picking by remember(exercise.exerciseId) { mutableStateOf(exercise.alternatives.isEmpty()) }
    if (picking) {
        ExercisePickerSheet(onDismiss = onDismiss, onSelect = onPick)
        return
    }
    val colorScheme = MaterialTheme.colorScheme
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = colorScheme.surfaceContainer
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp)
                .padding(bottom = 24.dp)
                .testTag("replace_sheet"),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Eyebrow(stringResource(R.string.workout_replace_title))
            Text(exercise.name, fontSize = 20.sp, fontWeight = FontWeight.SemiBold, color = colorScheme.onSurface)
            exercise.alternatives.forEach { alternative ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(18.dp))
                        .background(colorScheme.surfaceContainerHigh)
                        .clickable { onAlternative(alternative) }
                        .padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    alternative.images.firstOrNull()?.let { photo ->
                        SubcomposeAsyncImage(
                            model = photo,
                            contentDescription = alternative.name,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .size(56.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(colorScheme.surfaceContainerHighest),
                            error = {}
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(alternative.name, fontSize = 16.sp, fontWeight = FontWeight.Medium, color = colorScheme.onSurface)
                        alternative.equipment?.let {
                            Text(it, fontSize = 13.sp, color = colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
            FilledTonalButton(
                onClick = { picking = true },
                modifier = Modifier.fillMaxWidth()
            ) { Text(stringResource(R.string.workout_replace_other)) }
        }
    }
}
