package com.evgarct.form.ui.timeline

import androidx.compose.foundation.background
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evgarct.form.FormApp
import com.evgarct.form.core.theme.Ink
import com.evgarct.form.core.theme.LightInk
import com.evgarct.form.core.theme.RedAccent
import com.evgarct.form.core.theme.SurfaceCard
import com.evgarct.form.core.theme.SurfaceCardBorder
import com.evgarct.form.core.theme.TextMuted
import com.evgarct.form.core.theme.TextSecondary
import com.evgarct.form.core.theme.Trace
import com.evgarct.form.data.models.BodyMeasurements
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MeasurementEditorSheet(
    previousMeasurements: BodyMeasurements? = null,
    onDismiss: () -> Unit,
    onSaved: () -> Unit
) {
    val timelineRepo = FormApp.instance.timelineRepository
    val scope = rememberCoroutineScope()

    var selectedDate by remember { mutableStateOf(Date()) }
    var showDatePicker by remember { mutableStateOf(false) }

    var weight by remember { mutableStateOf("") }
    var chest by remember { mutableStateOf("") }
    var waist by remember { mutableStateOf("") }
    var abdomen by remember { mutableStateOf("") }
    var neck by remember { mutableStateOf("") }
    var hips by remember { mutableStateOf("") }
    var forearm by remember { mutableStateOf("") }
    var armRelaxed by remember { mutableStateOf("") }
    var armFlexed by remember { mutableStateOf("") }
    var thigh by remember { mutableStateOf("") }
    var calf by remember { mutableStateOf("") }

    var isSaving by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val hasAnyValue = listOf(weight, chest, waist, abdomen, neck, hips, forearm, armRelaxed, armFlexed, thigh, calf)
        .any { it.isNotBlank() }

    val dateFormatter = remember { SimpleDateFormat("EEEE, d MMMM", Locale.getDefault()) }

    fun save() {
        if (!hasAnyValue) return
        isSaving = true
        errorMessage = null

        val measurements = BodyMeasurements(
            weightKg = weight.toDoubleOrNull(),
            chestCm = chest.toDoubleOrNull(),
            waistCm = waist.toDoubleOrNull(),
            abdomenCm = abdomen.toDoubleOrNull(),
            neckCm = neck.toDoubleOrNull(),
            hipsCm = hips.toDoubleOrNull(),
            forearmCm = forearm.toDoubleOrNull(),
            leftBicepCm = armRelaxed.toDoubleOrNull(),
            leftBicepFlexedCm = armFlexed.toDoubleOrNull(),
            leftThighCm = thigh.toDoubleOrNull(),
            leftCalfCm = calf.toDoubleOrNull()
        )

        scope.launch {
            timelineRepo.createMeasurements(selectedDate, TimeZone.getDefault(), measurements)
                .onSuccess {
                    isSaving = false
                    onSaved()
                }
                .onFailure {
                    isSaving = false
                    errorMessage = it.message ?: "Failed to save measurements"
                }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Ink)
            .imePadding()
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(top = 40.dp)
        ) {
            // Top Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Cancel",
                    style = MaterialTheme.typography.bodyLarge,
                    color = TextSecondary,
                    modifier = Modifier.clickable { onDismiss() }
                )

                Text(
                    text = "Record Measurements",
                    style = MaterialTheme.typography.titleMedium,
                    color = LightInk
                )

                Text(
                    text = if (isSaving) "Saving..." else "Save",
                    style = MaterialTheme.typography.titleSmall,
                    color = if (hasAnyValue && !isSaving) Trace else TextMuted,
                    modifier = Modifier.clickable(enabled = hasAnyValue && !isSaving) { save() }
                )
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 8.dp)
            ) {
                // Date Row
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(SurfaceCard)
                        .clickable { showDatePicker = true }
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(text = "Date", style = MaterialTheme.typography.bodyMedium, color = TextSecondary)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(text = dateFormatter.format(selectedDate), style = MaterialTheme.typography.bodyMedium, color = LightInk)
                        Spacer(modifier = Modifier.width(8.dp))
                        Icon(Icons.Default.CalendarToday, contentDescription = null, tint = Trace, modifier = Modifier.size(16.dp))
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "Enter only the metrics you measured today. Others can be left blank.",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextMuted
                )

                if (errorMessage != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = errorMessage ?: "", color = RedAccent, style = MaterialTheme.typography.bodySmall)
                }

                Spacer(modifier = Modifier.height(20.dp))

                MeasurementInputField(
                    label = "Weight",
                    unit = "kg",
                    value = weight,
                    onValueChange = { weight = it },
                    previousValue = previousMeasurements?.weightKg
                )
                MeasurementInputField(
                    label = "Chest",
                    unit = "cm",
                    value = chest,
                    onValueChange = { chest = it },
                    previousValue = previousMeasurements?.chestCm
                )
                MeasurementInputField(
                    label = "Waist",
                    unit = "cm",
                    value = waist,
                    onValueChange = { waist = it },
                    previousValue = previousMeasurements?.waistCm
                )
                MeasurementInputField(
                    label = "Abdomen",
                    unit = "cm",
                    value = abdomen,
                    onValueChange = { abdomen = it },
                    previousValue = previousMeasurements?.abdomenCm
                )
                MeasurementInputField(
                    label = "Arm (relaxed)",
                    unit = "cm",
                    value = armRelaxed,
                    onValueChange = { armRelaxed = it },
                    previousValue = previousMeasurements?.armRelaxed
                )
                MeasurementInputField(
                    label = "Arm (flexed)",
                    unit = "cm",
                    value = armFlexed,
                    onValueChange = { armFlexed = it },
                    previousValue = previousMeasurements?.armFlexed
                )
                MeasurementInputField(
                    label = "Forearm",
                    unit = "cm",
                    value = forearm,
                    onValueChange = { forearm = it },
                    previousValue = previousMeasurements?.forearmCm
                )
                MeasurementInputField(
                    label = "Hips",
                    unit = "cm",
                    value = hips,
                    onValueChange = { hips = it },
                    previousValue = previousMeasurements?.hipsCm
                )
                MeasurementInputField(
                    label = "Thigh",
                    unit = "cm",
                    value = thigh,
                    onValueChange = { thigh = it },
                    previousValue = previousMeasurements?.thigh
                )
                MeasurementInputField(
                    label = "Calf",
                    unit = "cm",
                    value = calf,
                    onValueChange = { calf = it },
                    previousValue = previousMeasurements?.calf
                )
                MeasurementInputField(
                    label = "Neck",
                    unit = "cm",
                    value = neck,
                    onValueChange = { neck = it },
                    previousValue = previousMeasurements?.neckCm
                )

                Spacer(modifier = Modifier.height(32.dp))
            }
        }

        if (showDatePicker) {
            val datePickerState = rememberDatePickerState(initialSelectedDateMillis = selectedDate.time)
            DatePickerDialog(
                onDismissRequest = { showDatePicker = false },
                confirmButton = {
                    TextButton(onClick = {
                        datePickerState.selectedDateMillis?.let { selectedDate = Date(it) }
                        showDatePicker = false
                    }) {
                        Text("OK", color = Trace)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showDatePicker = false }) {
                        Text("Cancel", color = TextSecondary)
                    }
                }
            ) {
                DatePicker(state = datePickerState)
            }
        }
    }
}

@Composable
fun MeasurementInputField(
    label: String,
    unit: String,
    value: String,
    onValueChange: (String) -> Unit,
    previousValue: Double? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(text = label, style = MaterialTheme.typography.bodyLarge, color = LightInk)
            if (previousValue != null) {
                Text(
                    text = "Previous: ${String.format(Locale.US, "%.1f", previousValue)} $unit",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextMuted
                )
            }
        }

        OutlinedTextField(
            value = value,
            onValueChange = { text ->
                if (text.isEmpty() || text.matches(Regex("""^\d*\.?\d*$"""))) {
                    onValueChange(text)
                }
            },
            modifier = Modifier.width(110.dp),
            placeholder = { Text(unit, color = TextMuted) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            shape = RoundedCornerShape(10.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = SurfaceCard,
                unfocusedContainerColor = SurfaceCard,
                focusedBorderColor = Trace,
                unfocusedBorderColor = SurfaceCardBorder,
                focusedTextColor = LightInk,
                unfocusedTextColor = LightInk
            )
        )
    }
}
