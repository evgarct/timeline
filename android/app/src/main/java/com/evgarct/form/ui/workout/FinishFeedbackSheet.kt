package com.evgarct.form.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evgarct.form.R
import com.evgarct.form.data.models.WorkoutFeedback
import com.evgarct.form.ui.nutrition.components.FormModalSheet

private val moods = listOf("bad", "ok", "good")

/** "😞" / "😐" / "😊" for a stored mood id; null when there is none. */
internal fun moodEmoji(mood: String?): String? = when (mood) {
    "bad" -> "😞"
    "ok" -> "😐"
    "good" -> "😊"
    else -> null
}

/** End-of-workout feedback: difficulty 1–5, mood as one of three emoji, optional free text. All optional. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FinishFeedbackSheet(
    onDismiss: () -> Unit,
    onConfirm: (WorkoutFeedback) -> Unit
) {
    FormModalSheet(onDismissRequest = onDismiss, title = stringResource(R.string.workout_feedback_title)) {
        FinishFeedbackForm(onConfirm = onConfirm)
    }
}

@Composable
internal fun FinishFeedbackForm(
    onConfirm: (WorkoutFeedback) -> Unit,
    initial: WorkoutFeedback = WorkoutFeedback()
) {
    val colorScheme = MaterialTheme.colorScheme
    var exertion by remember { mutableStateOf(initial.exertion) }
    var mood by remember { mutableStateOf(initial.mood) }
    var note by remember { mutableStateOf(initial.note.orEmpty()) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .imePadding()
            .padding(horizontal = 22.dp)
            .padding(bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                stringResource(R.string.workout_feedback_exertion).uppercase(),
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.2.sp,
                color = colorScheme.onSurfaceVariant
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                (1..5).forEach { value ->
                    val selected = exertion == value
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(if (selected) colorScheme.primary else colorScheme.surfaceContainerHighest)
                            .clickable { exertion = if (selected) null else value },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            value.toString(),
                            fontSize = 20.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (selected) colorScheme.onPrimary else colorScheme.onSurface
                        )
                    }
                }
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(stringResource(R.string.workout_feedback_easy), fontSize = 12.sp, color = colorScheme.onSurfaceVariant)
                Text(stringResource(R.string.workout_feedback_hard), fontSize = 12.sp, color = colorScheme.onSurfaceVariant)
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                stringResource(R.string.workout_feedback_mood).uppercase(),
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.2.sp,
                color = colorScheme.onSurfaceVariant
            )
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.fillMaxWidth()) {
                moods.forEach { id ->
                    val selected = mood == id
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(64.dp)
                            .clip(RoundedCornerShape(20.dp))
                            .background(if (selected) colorScheme.primaryContainer else colorScheme.surfaceContainerHighest)
                            .clickable { mood = if (selected) null else id },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(moodEmoji(id).orEmpty(), fontSize = 30.sp)
                    }
                }
            }
        }

        OutlinedTextField(
            value = note,
            onValueChange = { note = it.take(2000) },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2,
            maxLines = 5,
            label = { Text(stringResource(R.string.workout_feedback_note)) }
        )

        Button(
            onClick = { onConfirm(WorkoutFeedback(exertion = exertion, mood = mood, note = note.trim().ifEmpty { null })) },
            modifier = Modifier.fillMaxWidth().height(54.dp),
            shape = RoundedCornerShape(18.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = colorScheme.primary,
                contentColor = colorScheme.onPrimary
            )
        ) {
            Text(
                stringResource(R.string.workout_feedback_finish),
                fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold,
                color = colorScheme.onPrimary
            )
        }
    }
}

/** "Difficulty 4/5 · 😊" for a finished session; null if neither was given. */
@Composable
internal fun feedbackLine(exertion: Int?, mood: String?): String? =
    listOfNotNull(
        exertion?.let { stringResource(R.string.workout_feedback_exertion_value, it) },
        moodEmoji(mood)
    ).joinToString(" · ").ifEmpty { null }
