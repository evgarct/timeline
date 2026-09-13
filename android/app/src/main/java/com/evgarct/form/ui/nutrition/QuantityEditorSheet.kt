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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.evgarct.form.core.theme.Ink
import com.evgarct.form.core.theme.SurfaceCardBorder
import com.evgarct.form.core.theme.TextMuted
import com.evgarct.form.core.theme.TextPrimary
import com.evgarct.form.core.theme.TextSecondary
import com.evgarct.form.data.models.FoodQuantity
import com.evgarct.form.data.models.MealType
import com.evgarct.form.data.models.NutrientValue
import com.evgarct.form.data.models.NutritionProduct
import com.evgarct.form.ui.nutrition.components.FormModalSheet
import java.util.Date

sealed class UnitMode {
    object Base : UnitMode()
    data class Piece(val size: String) : UnitMode()
    data class Serving(val label: String, val id: String?) : UnitMode()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuantityEditorSheet(
    product: NutritionProduct,
    mealType: MealType,
    date: Date,
    onDismiss: () -> Unit,
    onSaved: () -> Unit,
    onOpenNutrients: (List<NutrientValue>) -> Unit
) {
    val viewModel: NutritionViewModel = viewModel()

    var unitMode by remember { mutableStateOf<UnitMode>(UnitMode.Base) }
    var amount by remember { mutableStateOf(100.0) }
    var amountText by remember { mutableStateOf("100") }

    val currentQuantity = when (val mode = unitMode) {
        is UnitMode.Base -> {
            if (product.baseUnit == "ml") FoodQuantity.Milliliters(amount) else FoodQuantity.Grams(amount)
        }
        is UnitMode.Piece -> FoodQuantity.Pieces(amount, mode.size)
        is UnitMode.Serving -> FoodQuantity.Serving(amount, mode.label, mode.id)
    }

    val liveSummary = product.summaryFor(currentQuantity)

    // Optimistic: the entry appears in the cache (and thus on every screen sharing it)
    // immediately, so the sheet can close right away instead of waiting on the network.
    fun save() {
        if (amount <= 0) return
        viewModel.addEntryOptimistic(product, mealType, currentQuantity, date)
        onSaved()
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
                    .padding(horizontal = 22.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(TextPrimary.copy(alpha = 0.12f))
                        .clickable { onDismiss() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Cancel",
                        tint = TextPrimary,
                        modifier = Modifier.size(18.dp)
                    )
                }

                Text(
                    text = "Add to ${mealType.name.lowercase().replaceFirstChar { it.uppercase() }}",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Medium,
                    color = TextPrimary
                )

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(18.dp))
                        .background(if (amount > 0) TextPrimary else TextPrimary.copy(alpha = 0.12f))
                        .clickable(enabled = amount > 0) { save() }
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Add",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (amount > 0) Ink else TextMuted
                    )
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 22.dp, vertical = 14.dp),
                verticalArrangement = Arrangement.spacedBy(28.dp)
            ) {
                // Product Title & Brand
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = product.name,
                        fontSize = 32.sp,
                        fontFamily = FontFamily.Serif,
                        letterSpacing = (-0.8).sp,
                        color = TextPrimary
                    )
                    product.brand?.let {
                        Text(
                            text = it,
                            fontSize = 16.sp,
                            color = TextSecondary
                        )
                    }
                }

                // Live 4-Column Macros (Directly on background)
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    MacroColumnsHeader()
                    MacroColumns(
                        summary = liveSummary,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Light
                    )
                }

                // Portions & Units
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "PORTION & UNITS",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 1.2.sp,
                        color = TextMuted
                    )

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
                }

                // Amount Stepper / Input
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "AMOUNT",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 1.2.sp,
                        color = TextMuted
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        // Glass minus button
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .clip(CircleShape)
                                .background(TextPrimary.copy(alpha = 0.12f))
                                .clickable {
                                    val current = amountText.toDoubleOrNull() ?: 1.0
                                    val step = if (unitMode is UnitMode.Base) 10.0 else 1.0
                                    val newV = (current - step).coerceAtLeast(0.0)
                                    amount = newV
                                    amountText = if (newV % 1.0 == 0.0) newV.toInt().toString() else newV.toString()
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Remove, contentDescription = "Decrease", tint = TextPrimary, modifier = Modifier.size(20.dp))
                        }

                        // Glass pill amount field
                        Box(
                            modifier = Modifier
                                .width(140.dp)
                                .height(50.dp)
                                .clip(RoundedCornerShape(25.dp))
                                .background(TextPrimary.copy(alpha = 0.12f)),
                            contentAlignment = Alignment.Center
                        ) {
                            BasicTextField(
                                value = amountText,
                                onValueChange = { text ->
                                    amountText = text
                                    amount = text.toDoubleOrNull() ?: 0.0
                                },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                textStyle = TextStyle(
                                    fontSize = 24.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Medium,
                                    color = TextPrimary,
                                    textAlign = TextAlign.Center
                                ),
                                cursorBrush = SolidColor(TextPrimary),
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp)
                            )
                        }

                        // Glass plus button
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .clip(CircleShape)
                                .background(TextPrimary.copy(alpha = 0.12f))
                                .clickable {
                                    val current = amountText.toDoubleOrNull() ?: 0.0
                                    val step = if (unitMode is UnitMode.Base) 10.0 else 1.0
                                    val newV = current + step
                                    amount = newV
                                    amountText = if (newV % 1.0 == 0.0) newV.toInt().toString() else newV.toString()
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Add, contentDescription = "Increase", tint = TextPrimary, modifier = Modifier.size(20.dp))
                        }
                    }
                }

                // All Nutrients Chevron Row
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(SurfaceCardBorder.copy(alpha = 0.4f))
                        .clickable {
                            val scaled = product.referenceBase?.nutrients ?: emptyList()
                            onOpenNutrients(scaled)
                        }
                        .padding(horizontal = 18.dp, vertical = 14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "All Nutrients",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Medium,
                        color = TextPrimary
                    )
                    Icon(
                        imageVector = Icons.Default.ChevronRight,
                        contentDescription = null,
                        tint = TextMuted,
                        modifier = Modifier.size(20.dp)
                    )
                }

                Spacer(modifier = Modifier.height(30.dp))
            }
        }
    }
}

@Composable
fun PortionChip(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .clip(CircleShape)
            .background(if (isSelected) TextPrimary else TextPrimary.copy(alpha = 0.12f))
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = if (isSelected) Ink else TextPrimary
        )
    }
}
