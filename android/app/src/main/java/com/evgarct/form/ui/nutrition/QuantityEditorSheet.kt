package com.evgarct.form.ui.nutrition

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evgarct.form.FormApp
import com.evgarct.form.core.theme.Ink
import com.evgarct.form.core.theme.LightInk
import com.evgarct.form.core.theme.SurfaceCard
import com.evgarct.form.core.theme.SurfaceCardBorder
import com.evgarct.form.core.theme.TextMuted
import com.evgarct.form.core.theme.TextSecondary
import com.evgarct.form.core.theme.Trace
import com.evgarct.form.data.models.FoodQuantity
import com.evgarct.form.data.models.MealType
import com.evgarct.form.data.models.NutrientValue
import com.evgarct.form.data.models.NutritionProduct
import com.evgarct.form.ui.components.GlassCard
import com.evgarct.form.ui.components.SerifNumber
import kotlinx.coroutines.launch
import java.util.Date
import java.util.TimeZone

sealed class UnitMode {
    object Base : UnitMode()
    data class Piece(val size: String) : UnitMode()
    data class Serving(val label: String, val id: String?) : UnitMode()
}

@Composable
fun QuantityEditorSheet(
    product: NutritionProduct,
    mealType: MealType,
    date: Date,
    onDismiss: () -> Unit,
    onSaved: () -> Unit,
    onOpenNutrients: (List<NutrientValue>) -> Unit
) {
    val nutritionRepo = FormApp.instance.nutritionRepository
    val scope = rememberCoroutineScope()

    var unitMode by remember { mutableStateOf<UnitMode>(UnitMode.Base) }
    var amount by remember { mutableStateOf(100.0) }
    var amountText by remember { mutableStateOf("100") }
    var isSaving by remember { mutableStateOf(false) }

    val currentQuantity = when (val mode = unitMode) {
        is UnitMode.Base -> {
            if (product.baseUnit == "ml") FoodQuantity.Milliliters(amount) else FoodQuantity.Grams(amount)
        }
        is UnitMode.Piece -> FoodQuantity.Pieces(amount, mode.size)
        is UnitMode.Serving -> FoodQuantity.Serving(amount, mode.label, mode.id)
    }

    val liveSummary = product.summaryFor(currentQuantity)

    fun save() {
        if (amount <= 0 || isSaving) return
        isSaving = true
        scope.launch {
            nutritionRepo.recordEntry(
                productId = product.id,
                mealType = mealType,
                quantity = currentQuantity,
                date = date,
                timezone = TimeZone.getDefault()
            ).onSuccess {
                isSaving = false
                onSaved()
            }.onFailure {
                isSaving = false
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
                    text = "Add to ${mealType.name.lowercase().replaceFirstChar { it.uppercase() }}",
                    style = MaterialTheme.typography.titleMedium,
                    color = LightInk
                )

                Text(
                    text = if (isSaving) "Adding..." else "Add",
                    style = MaterialTheme.typography.titleSmall,
                    color = if (amount > 0 && !isSaving) Trace else TextMuted,
                    modifier = Modifier.clickable(enabled = amount > 0 && !isSaving) { save() }
                )
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 8.dp)
            ) {
                Text(text = product.name, style = MaterialTheme.typography.headlineMedium, color = LightInk)
                product.brand?.let {
                    Text(text = it, style = MaterialTheme.typography.bodyMedium, color = TextSecondary)
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Live Macro Preview Card
                GlassCard(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceAround,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        MacroColumn("Calories", "${liveSummary.calories.toInt()} kcal", Trace)
                        MacroColumn("Protein", "${liveSummary.protein.toInt()} g", LightInk)
                        MacroColumn("Fat", "${liveSummary.fat.toInt()} g", LightInk)
                        MacroColumn("Carbs", "${liveSummary.carbohydrates.toInt()} g", LightInk)
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Quick Select Chips
                Text(text = "PORTION & UNITS", style = MaterialTheme.typography.labelSmall, color = Trace)
                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val isBaseSelected = unitMode is UnitMode.Base
                    PortionChip(
                        label = "100 ${product.baseUnit}",
                        isSelected = isBaseSelected,
                        onClick = {
                            unitMode = UnitMode.Base
                            amount = 100.0
                            amountText = "100"
                        }
                    )

                    product.pieceSizes.firstOrNull()?.let { piece ->
                        val isPieceSelected = (unitMode as? UnitMode.Piece)?.size == piece.size
                        PortionChip(
                            label = piece.size,
                            isSelected = isPieceSelected,
                            onClick = {
                                unitMode = UnitMode.Piece(piece.size)
                                amount = 1.0
                                amountText = "1"
                            }
                        )
                    }

                    product.servingSizes.firstOrNull()?.let { serving ->
                        val isServingSelected = (unitMode as? UnitMode.Serving)?.label == serving.label
                        PortionChip(
                            label = serving.label,
                            isSelected = isServingSelected,
                            onClick = {
                                unitMode = UnitMode.Serving(serving.label, serving.id)
                                amount = 1.0
                                amountText = "1"
                            }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Amount Stepper / Input
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Amount",
                        style = MaterialTheme.typography.bodyLarge,
                        color = LightInk
                    )

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(
                            onClick = {
                                val current = amountText.toDoubleOrNull() ?: 1.0
                                val step = if (unitMode is UnitMode.Base) 10.0 else 1.0
                                val newV = (current - step).coerceAtLeast(0.0)
                                amount = newV
                                amountText = if (newV % 1.0 == 0.0) newV.toInt().toString() else newV.toString()
                            }
                        ) {
                            Icon(Icons.Default.Remove, contentDescription = "Decrease", tint = Trace)
                        }

                        OutlinedTextField(
                            value = amountText,
                            onValueChange = { text ->
                                amountText = text
                                amount = text.toDoubleOrNull() ?: 0.0
                            },
                            modifier = Modifier.width(100.dp),
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

                        IconButton(
                            onClick = {
                                val current = amountText.toDoubleOrNull() ?: 0.0
                                val step = if (unitMode is UnitMode.Base) 10.0 else 1.0
                                val newV = current + step
                                amount = newV
                                amountText = if (newV % 1.0 == 0.0) newV.toInt().toString() else newV.toString()
                            }
                        ) {
                            Icon(Icons.Default.Add, contentDescription = "Increase", tint = Trace)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(32.dp))

                // All nutrients link
                Text(
                    text = "All nutrients",
                    style = MaterialTheme.typography.bodyLarge,
                    color = Trace,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(SurfaceCard)
                        .clickable {
                            val scaled = product.referenceBase?.nutrients ?: emptyList()
                            onOpenNutrients(scaled)
                        }
                        .padding(16.dp)
                )
            }
        }
    }
}

@Composable
fun MacroColumn(label: String, value: String, color: androidx.compose.ui.graphics.Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = label, style = MaterialTheme.typography.bodySmall, color = TextMuted)
        Spacer(modifier = Modifier.height(2.dp))
        Text(text = value, style = MaterialTheme.typography.titleMedium, color = color, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun PortionChip(label: String, isSelected: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(if (isSelected) Trace else SurfaceCard)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp)
    ) {
        Text(
            text = label,
            fontSize = 13.sp,
            color = if (isSelected) LightInk else TextSecondary,
            fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal
        )
    }
}
