package com.evgarct.form.ui.activity

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.health.connect.client.PermissionController
import com.evgarct.form.FormApp
import com.evgarct.form.R
import com.evgarct.form.data.models.DailyActivitySnapshot
import com.evgarct.form.data.repository.ActivityDataState
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Persistent Activity tab — the same live day/week/average view as the
 * Today-launched [com.evgarct.form.ui.today.ActivityDetailSheet], plus a short
 * history list backed by the server (the "step counter tracker" foundation).
 */
@Composable
fun ActivityScreen() {
    val healthRepo = FormApp.instance.healthConnectRepository
    val activityRepo = FormApp.instance.activityRepository
    val prefs = FormApp.instance.appPreferences
    val scope = rememberCoroutineScope()

    var selectedDate by remember { mutableStateOf(LocalDate.now()) }
    var activityState by remember { mutableStateOf<ActivityDataState>(ActivityDataState.Loading) }
    var history by remember { mutableStateOf<List<DailyActivitySnapshot>>(emptyList()) }
    var showGoalDialog by remember { mutableStateOf(false) }
    var goalInput by remember { mutableStateOf("${prefs.stepGoal}") }

    val today = remember { LocalDate.now() }
    val dateFormatter = remember { DateTimeFormatter.ofPattern("EEE, d MMMM", Locale.getDefault()) }

    fun refreshActivity() {
        scope.launch {
            activityState = ActivityDataState.Loading
            activityState = healthRepo.getActivityData(selectedDate, prefs.stepGoal)
        }
    }

    fun refreshHistory() {
        scope.launch {
            activityRepo.getHistory(today.minusDays(13), today.minusDays(1))
                .onSuccess { history = it.sortedByDescending { day -> day.activityDate } }
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = PermissionController.createRequestPermissionResultContract()
    ) {
        refreshActivity()
    }

    LaunchedEffect(selectedDate) {
        refreshActivity()
    }

    LaunchedEffect(Unit) {
        refreshHistory()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .padding(top = 10.dp)
        ) {
            Text(
                text = "Activity",
                fontSize = 34.sp,
                fontFamily = FontFamily.Serif,
                letterSpacing = (-0.8).sp,
                color = MaterialTheme.colorScheme.onBackground,
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp)
            )

            ActivityDateNavCapsule(
                selectedDate = selectedDate,
                today = today,
                dateFormatter = dateFormatter,
                onPreviousDay = { selectedDate = selectedDate.minusDays(1) },
                onNextDay = { selectedDate = selectedDate.plusDays(1) },
                onPickDate = { /* handled inline by day-stepper only in this tab */ }
            )

            ActivityContent(
                selectedDate = selectedDate,
                activityState = activityState,
                onRequestPermission = { permissionLauncher.launch(healthRepo.permissions) },
                onEditGoal = {
                    val currentGoal = (activityState as? ActivityDataState.Value)?.goal ?: prefs.stepGoal
                    goalInput = "$currentGoal"
                    showGoalDialog = true
                },
                extraContent = {
                    if (history.isNotEmpty()) {
                        ActivityHistorySection(history = history)
                    }
                }
            )
        }

        if (showGoalDialog) {
            AlertDialog(
                onDismissRequest = { showGoalDialog = false },
                title = { Text(text = stringResource(R.string.activity_goal_title), fontSize = 20.sp, fontWeight = FontWeight.SemiBold) },
                text = {
                    OutlinedTextField(
                        value = goalInput,
                        onValueChange = { input -> goalInput = input.filter { it.isDigit() }.take(6) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        colors = OutlinedTextFieldDefaults.colors(),
                        modifier = Modifier.fillMaxWidth()
                    )
                },
                confirmButton = {
                    TextButton(onClick = {
                        val newGoal = goalInput.toIntOrNull()
                        if (newGoal != null && newGoal in 1_000..100_000) {
                            prefs.stepGoal = newGoal
                            refreshActivity()
                        }
                        showGoalDialog = false
                    }) {
                        Text(stringResource(R.string.common_save), fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showGoalDialog = false }) {
                        Text(stringResource(R.string.common_cancel))
                    }
                },
                shape = RoundedCornerShape(24.dp)
            )
        }
    }
}

@Composable
private fun ActivityHistorySection(history: List<DailyActivitySnapshot>) {
    val dayFormatter = remember { DateTimeFormatter.ofPattern("EEE, d MMM", Locale.getDefault()) }
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "HISTORY",
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 1.2.sp,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
        )

        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            history.forEach { day ->
                val date = LocalDate.parse(day.activityDate)
                val fraction = if (day.goalSteps > 0) {
                    (day.steps.toFloat() / day.goalSteps).coerceIn(0f, 1f)
                } else 0f

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = dayFormatter.format(date),
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                        modifier = Modifier.padding(end = 4.dp)
                    )

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(4.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.onBackground.copy(alpha = 0.12f))
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth(fraction)
                                .height(4.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.primary)
                        )
                    }

                    Text(
                        text = String.format(Locale.US, "%,d", day.steps),
                        fontSize = 13.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                }
            }
        }
    }
}

