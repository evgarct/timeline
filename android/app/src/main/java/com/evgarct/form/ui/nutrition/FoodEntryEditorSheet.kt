package com.evgarct.form.ui.nutrition

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.evgarct.form.core.theme.RedAccent
import com.evgarct.form.core.theme.TextMuted
import com.evgarct.form.core.theme.TextPrimary
import com.evgarct.form.core.theme.TextSecondary
import com.evgarct.form.data.models.FoodEntry
import com.evgarct.form.data.models.FoodQuantity
import com.evgarct.form.data.models.MealType
import com.evgarct.form.data.models.NutrientValue
import com.evgarct.form.data.models.icon
import com.evgarct.form.data.models.parseIsoDate
import com.evgarct.form.ui.nutrition.components.FormModalSheet
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FoodEntryEditorSheet(
    entry: FoodEntry,
    onDismiss: () -> Unit,
    onUpdated: () -> Unit,
    onDeleted: () -> Unit,
    onOpenNutrients: (List<NutrientValue>) -> Unit
) {
    val viewModel: NutritionViewModel = viewModel()
    val colorScheme = MaterialTheme.colorScheme
    val originalDate = remember { parseIsoDate(entry.occurredAt) }

    var selectedMealType by remember { mutableStateOf(entry.mealType) }
    var amountText by remember { mutableStateOf(entry.quantity.amount.let { if (it % 1.0 == 0.0) it.toInt().toString() else it.toString() }) }
    var selectedDate by remember { mutableStateOf(originalDate) }
    var showDatePicker by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }

    val dateFormatter = remember { SimpleDateFormat("EEEE, d MMMM", Locale.getDefault()) }

    // Optimistic: the sheet closes immediately, the cache reflects the change right away.
    fun update() {
        val newAmount = amountText.toDoubleOrNull() ?: return
        if (newAmount <= 0) return

        val updatedQuantity = when (val q = entry.quantity) {
            is FoodQuantity.Grams -> FoodQuantity.Grams(newAmount)
            is FoodQuantity.Milliliters -> FoodQuantity.Milliliters(newAmount)
            is FoodQuantity.Pieces -> FoodQuantity.Pieces(newAmount, q.size)
            is FoodQuantity.Serving -> FoodQuantity.Serving(newAmount, q.label, q.servingSizeId)
            is FoodQuantity.AsConsumed -> q
        }

        viewModel.updateEntryOptimistic(entry, selectedMealType, updatedQuantity, originalDate, selectedDate)
        onUpdated()
    }

    fun delete() {
        viewModel.deleteEntryOptimistic(entry, originalDate)
        onDeleted()
    }

    FormModalSheet(onDismissRequest = onDismiss, title = "Edit entry") {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 8.dp)
        ) {
            Text(
                text = entry.productSnapshot.name,
                style = MaterialTheme.typography.headlineSmall,
                color = TextPrimary
            )
            entry.productSnapshot.brand?.let {
                Text(text = it, style = MaterialTheme.typography.bodyMedium, color = TextSecondary)
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Meal Type Picker
            Text(text = "MEAL", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.2.sp, color = TextMuted)
            Spacer(modifier = Modifier.height(10.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                MealType.values().forEach { type ->
                    val isSelected = selectedMealType == type
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(16.dp))
                            .background(if (isSelected) colorScheme.secondaryContainer else colorScheme.surfaceContainer)
                            .clickable { selectedMealType = type }
                            .padding(vertical = 10.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = type.icon,
                            contentDescription = null,
                            tint = if (isSelected) colorScheme.onSecondaryContainer else TextMuted,
                            modifier = Modifier.size(18.dp)
                        )
                        Text(
                            text = type.name.lowercase().replaceFirstChar { it.uppercase() },
                            fontSize = 12.sp,
                            fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                            color = if (isSelected) colorScheme.onSecondaryContainer else TextMuted
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Quantity Row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(colorScheme.surfaceContainer)
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(text = "Quantity", style = MaterialTheme.typography.bodyLarge, color = TextPrimary)

                Box(
                    modifier = Modifier
                        .width(110.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(colorScheme.surfaceContainerHigh)
                        .padding(horizontal = 10.dp, vertical = 8.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.End, modifier = Modifier.fillMaxWidth()) {
                        BasicTextField(
                            value = amountText,
                            onValueChange = { text ->
                                if (text.isEmpty() || text.matches(Regex("""^\d*\.?\d*$"""))) {
                                    amountText = text
                                }
                            },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            textStyle = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Medium, color = TextPrimary, textAlign = TextAlign.End),
                            cursorBrush = SolidColor(TextPrimary),
                            modifier = Modifier.weight(1f, fill = false)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(text = entry.quantity.unitLabel, fontSize = 12.sp, color = TextMuted)
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Date Row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(colorScheme.surfaceContainer)
                    .clickable { showDatePicker = true }
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(text = "Date", style = MaterialTheme.typography.bodyLarge, color = TextPrimary)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(text = dateFormatter.format(selectedDate), style = MaterialTheme.typography.bodyMedium, color = TextSecondary)
                    Icon(Icons.Default.CalendarToday, contentDescription = null, tint = colorScheme.primary, modifier = Modifier.size(16.dp))
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // All Nutrients link
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(colorScheme.surfaceContainer)
                    .clickable { onOpenNutrients(entry.productSnapshot.nutrients) }
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(text = "All nutrients", style = MaterialTheme.typography.bodyLarge, color = TextPrimary)
                Icon(Icons.Default.ChevronRight, contentDescription = null, tint = TextMuted, modifier = Modifier.size(18.dp))
            }

            Spacer(modifier = Modifier.height(28.dp))

            Button(
                onClick = { update() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = colorScheme.primaryContainer,
                    contentColor = colorScheme.onPrimaryContainer
                )
            ) {
                Text("Save", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            }

            Spacer(modifier = Modifier.height(10.dp))

            Button(
                onClick = { showDeleteConfirm = true },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = RedAccent.copy(alpha = 0.15f),
                    contentColor = RedAccent
                )
            ) {
                Icon(Icons.Default.DeleteOutline, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Delete entry", fontWeight = FontWeight.SemiBold)
            }

            Spacer(modifier = Modifier.height(24.dp))
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
                        Text("OK", color = colorScheme.primary)
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

        if (showDeleteConfirm) {
            AlertDialog(
                onDismissRequest = { showDeleteConfirm = false },
                title = { Text("Delete entry?") },
                text = { Text("Are you sure you want to remove this food entry?") },
                confirmButton = {
                    TextButton(onClick = {
                        showDeleteConfirm = false
                        delete()
                    }) {
                        Text("Delete", color = RedAccent)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showDeleteConfirm = false }) {
                        Text("Cancel", color = TextSecondary)
                    }
                }
            )
        }
    }
}
