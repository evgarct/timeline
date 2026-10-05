package com.evgarct.form.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evgarct.form.FormApp
import com.evgarct.form.R
import com.evgarct.form.data.models.Exercise
import com.evgarct.form.ui.nutrition.components.FormModalSheet
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Search-or-create picker over the personal exercise catalog (`/api/exercises`). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExercisePickerSheet(
    onDismiss: () -> Unit,
    onSelect: (Exercise) -> Unit
) {
    val repository = FormApp.instance.workoutRepository
    val scope = rememberCoroutineScope()
    val colorScheme = MaterialTheme.colorScheme

    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<Exercise>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var isCreating by remember { mutableStateOf(false) }

    // Debounced: wait for the typing to settle, then search the whole catalog server-side.
    LaunchedEffect(query) {
        if (query.isNotEmpty()) delay(250)
        isLoading = true
        repository.searchExercises(query.trim()).onSuccess { results = it.items }
        isLoading = false
    }

    val trimmed = query.trim()
    val exactMatch = results.any { it.name.equals(trimmed, ignoreCase = true) }

    FormModalSheet(onDismissRequest = onDismiss, title = stringResource(R.string.workout_add_exercise)) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .imePadding()
                .padding(horizontal = 20.dp)
                .padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(colorScheme.surfaceContainerHighest)
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Icon(Icons.Rounded.Search, contentDescription = null, tint = colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
                Box(modifier = Modifier.weight(1f)) {
                    if (query.isEmpty()) {
                        Text(stringResource(R.string.workout_search_hint), color = colorScheme.onSurfaceVariant, fontSize = 16.sp)
                    }
                    BasicTextField(
                        value = query,
                        onValueChange = { query = it },
                        singleLine = true,
                        textStyle = TextStyle(color = colorScheme.onSurface, fontSize = 16.sp),
                        cursorBrush = SolidColor(colorScheme.primary),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                if (isLoading) CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 420.dp)
                    .verticalScroll(rememberScrollState())
            ) {
                if (trimmed.isNotEmpty() && !exactMatch) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable(enabled = !isCreating) {
                                isCreating = true
                                scope.launch {
                                    repository.createExercise(trimmed, emptyList(), null).onSuccess(onSelect)
                                    isCreating = false
                                }
                            }
                            .padding(vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(Icons.Rounded.Add, contentDescription = null, tint = colorScheme.primary, modifier = Modifier.size(22.dp))
                        Text(
                            stringResource(R.string.workout_create, trimmed),
                            color = colorScheme.primary,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }

                results.forEach { exercise ->
                    key(exercise.id) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onSelect(exercise) }
                                .padding(vertical = 12.dp)
                        ) {
                            Text(exercise.name, color = colorScheme.onSurface, fontSize = 16.sp)
                            val meta = listOfNotNull(
                                exercise.primaryMuscles.joinToString(", ").ifBlank { null },
                                exercise.equipment
                            ).joinToString(" · ")
                            if (meta.isNotEmpty()) {
                                Text(meta, color = colorScheme.onSurfaceVariant, fontSize = 13.sp)
                            }
                        }
                    }
                }

                if (!isLoading && results.isEmpty() && trimmed.isEmpty()) {
                    Text(
                        stringResource(R.string.workout_no_results),
                        color = colorScheme.onSurfaceVariant,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(vertical = 16.dp)
                    )
                }
            }
        }
    }
}
