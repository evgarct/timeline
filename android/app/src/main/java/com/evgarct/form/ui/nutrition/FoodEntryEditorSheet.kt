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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.evgarct.form.core.theme.LightInk
import com.evgarct.form.core.theme.RedAccent
import com.evgarct.form.core.theme.SurfaceCard
import com.evgarct.form.core.theme.SurfaceCardBorder
import com.evgarct.form.core.theme.TextSecondary
import com.evgarct.form.core.theme.Trace
import com.evgarct.form.data.models.FoodEntry
import com.evgarct.form.data.models.FoodQuantity
import com.evgarct.form.data.models.MealType
import com.evgarct.form.data.models.NutrientValue
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

    FormModalSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .imePadding()
        ) {
            // Header
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
                    text = "Edit Entry",
                    style = MaterialTheme.typography.titleMedium,
                    color = LightInk
                )

                Text(
                    text = "Save",
                    style = MaterialTheme.typography.titleSmall,
                    color = Trace,
                    modifier = Modifier.clickable { update() }
                )
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 8.dp)
            ) {
                Text(
                    text = entry.productSnapshot.name,
                    style = MaterialTheme.typography.headlineMedium,
                    color = LightInk
                )
                entry.productSnapshot.brand?.let {
                    Text(text = it, style = MaterialTheme.typography.bodyMedium, color = TextSecondary)
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Meal Type Picker
                Text(text = "MEAL", style = MaterialTheme.typography.labelSmall, color = Trace)
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(SurfaceCard)
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    listOf(
                        MealType.BREAKFAST to "Breakfast",
                        MealType.LUNCH to "Lunch",
                        MealType.DINNER to "Dinner",
                        MealType.SNACK to "Snack"
                    ).forEach { (type, label) ->
                        val isSelected = selectedMealType == type
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isSelected) Trace else androidx.compose.ui.graphics.Color.Transparent)
                                .clickable { selectedMealType = type }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = label,
                                style = MaterialTheme.typography.bodySmall,
                                color = if (isSelected) LightInk else TextSecondary,
                                fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Quantity Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Quantity (${entry.quantity.unitLabel})",
                        style = MaterialTheme.typography.bodyLarge,
                        color = LightInk
                    )

                    OutlinedTextField(
                        value = amountText,
                        onValueChange = { text ->
                            if (text.isEmpty() || text.matches(Regex("""^\d*\.?\d*$"""))) {
                                amountText = text
                            }
                        },
                        modifier = Modifier.width(120.dp),
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

                Spacer(modifier = Modifier.height(20.dp))

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

                Spacer(modifier = Modifier.height(24.dp))

                // All Nutrients link
                Text(
                    text = "All nutrients",
                    style = MaterialTheme.typography.bodyLarge,
                    color = Trace,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(SurfaceCard)
                        .clickable { onOpenNutrients(entry.productSnapshot.nutrients) }
                        .padding(16.dp)
                )

                Spacer(modifier = Modifier.height(32.dp))

                // Delete Button
                Button(
                    onClick = { showDeleteConfirm = true },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = RedAccent.copy(alpha = 0.15f),
                        contentColor = RedAccent
                    )
                ) {
                    Text("Delete entry", fontWeight = FontWeight.SemiBold)
                }
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
