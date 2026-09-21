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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.BakeryDining
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.OilBarrel
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.evgarct.form.FormApp
import com.evgarct.form.core.theme.Ink
import com.evgarct.form.core.theme.SurfaceCardBorder
import com.evgarct.form.core.theme.TextMuted
import com.evgarct.form.core.theme.TextPrimary
import com.evgarct.form.core.theme.TextSecondary
import com.evgarct.form.data.models.FoodQuantity
import com.evgarct.form.data.models.MealType
import com.evgarct.form.data.models.NutritionProduct
import com.evgarct.form.ui.nutrition.components.FormModalSheet
import java.util.Date
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope

/** Per-row mutable state; a plain class (not a data class held in Compose state) so each
 * row's stepper/text edits recompose only that row instead of the whole product list. */
private class BatchRowState(unitMode: UnitMode, amount: Double, amountText: String) {
    var unitMode by mutableStateOf(unitMode)
    var amount by mutableStateOf(amount)
    var amountText by mutableStateOf(amountText)
}

private fun BatchRowState.quantityFor(product: NutritionProduct): FoodQuantity = when (val mode = unitMode) {
    is UnitMode.Base -> if (product.baseUnit == "ml") FoodQuantity.Milliliters(amount) else FoodQuantity.Grams(amount)
    is UnitMode.Piece -> FoodQuantity.Pieces(amount, mode.size)
    is UnitMode.Serving -> FoodQuantity.Serving(amount, mode.label, mode.id)
}

/** A serving/piece label is usually itself a "one unit" description (e.g. "1 капсула",
 * "1 шт (43.5 г)"), so pairing it with the amount as-is reads like two numbers mashed
 * together ("4 1 капсула"). Stripping a leading "1 " leaves just the noun ("капсула"). */
private fun stripLeadingOne(label: String): String {
    val trimmed = label.trim()
    return if (trimmed.startsWith("1 ")) trimmed.removePrefix("1 ").trim() else trimmed
}

private fun BatchRowState.portionText(product: NutritionProduct): String = when (val mode = unitMode) {
    is UnitMode.Base -> "$amountText ${product.baseUnit}"
    is UnitMode.Piece -> "$amountText × ${stripLeadingOne(mode.size)}"
    is UnitMode.Serving -> "$amountText × ${stripLeadingOne(mode.label)}"
}

/**
 * Confirms portions for several products chosen at once from [ProductSearchSheet]'s
 * multi-select mode. Every row defaults to the amount/unit the user last logged for that
 * product (same source as [QuantityEditorSheet]), editable per row before the batch add.
 * Macro columns mirror [MacroColumnsHeader]/[MacroColumns] from the main nutrition screen
 * (icons instead of the P/F/C/KCAL letters, same right-aligned grid) so figures line up
 * the same way here as everywhere else in the app.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BatchQuantityEditorSheet(
    products: List<NutritionProduct>,
    mealType: MealType,
    date: Date,
    onDismiss: () -> Unit,
    onSaved: () -> Unit
) {
    val viewModel: NutritionViewModel = viewModel()
    val nutritionRepo = FormApp.instance.nutritionRepository

    val rowStates = remember(products) {
        products.associate { it.id to BatchRowState(UnitMode.Base, 100.0, "100") }
    }

    LaunchedEffect(products) {
        val lastQuantities = coroutineScope {
            products.map { product ->
                async { product.id to nutritionRepo.getLastQuantity(product.id).getOrNull() }
            }.awaitAll()
        }
        for ((productId, last) in lastQuantities) {
            val state = rowStates[productId] ?: continue
            val product = products.first { it.id == productId }
            when (last) {
                is FoodQuantity.Grams -> {
                    state.unitMode = UnitMode.Base
                    state.amount = last.amount
                    state.amountText = formatAmount(last.amount)
                }
                is FoodQuantity.Milliliters -> {
                    state.unitMode = UnitMode.Base
                    state.amount = last.amount
                    state.amountText = formatAmount(last.amount)
                }
                is FoodQuantity.Pieces -> {
                    val match = product.pieceSizes.firstOrNull { it.size == last.size }
                    if (match != null) {
                        state.unitMode = UnitMode.Piece(match.size)
                        state.amount = last.amount
                        state.amountText = formatAmount(last.amount)
                    }
                }
                is FoodQuantity.Serving -> {
                    val match = product.servingSizes.firstOrNull { it.id == last.servingSizeId || it.label == last.label }
                    if (match != null) {
                        state.unitMode = UnitMode.Serving(match.label, match.id)
                        state.amount = last.amount
                        state.amountText = formatAmount(last.amount)
                    }
                }
                null, is FoodQuantity.AsConsumed -> Unit
            }
        }
    }

    fun save() {
        products.forEach { product ->
            val state = rowStates[product.id] ?: return@forEach
            if (state.amount <= 0) return@forEach
            viewModel.addEntryOptimistic(product, mealType, state.quantityFor(product), date)
        }
        onSaved()
    }

    FormModalSheet(onDismissRequest = onDismiss) {
        Column(modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp)) {
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
                    Icon(Icons.Default.Close, contentDescription = "Cancel", tint = TextPrimary, modifier = Modifier.size(18.dp))
                }

                Text(
                    text = "Add ${products.size} items",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Medium,
                    color = TextPrimary
                )

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(18.dp))
                        .background(TextPrimary)
                        .clickable { save() }
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(text = "Add all", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                }
            }

            Box(modifier = Modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 4.dp)) {
                MacroIconHeader()
            }

            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 480.dp)
                    .padding(horizontal = 22.dp)
            ) {
                items(products, key = { it.id }) { product ->
                    val state = rowStates[product.id] ?: return@items
                    BatchProductRow(product = product, state = state)
                }
            }
        }
    }
}

/** Icon-only counterpart to [MacroColumnsHeader]'s P/F/C/KCAL letters, same weighted grid.
 * Shared with [ProductSearchSheet] so every product list in the nutrition flow (recents,
 * database, search results, batch confirmation) uses the same header instead of abbreviations. */
@Composable
internal fun MacroIconHeader(color: Color = TextMuted) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        listOf(
            Icons.Default.FitnessCenter,
            Icons.Default.OilBarrel,
            Icons.Default.BakeryDining,
            Icons.Default.LocalFireDepartment
        ).forEach { icon ->
            Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.CenterEnd) {
                Icon(imageVector = icon, contentDescription = null, tint = color, modifier = Modifier.size(14.dp))
            }
        }
    }
}

@Composable
private fun BatchProductRow(product: NutritionProduct, state: BatchRowState) {
    val summary = product.summaryFor(state.quantityFor(product))

    fun applyDelta(delta: Double) {
        val step = if (state.unitMode is UnitMode.Base) delta * 10.0 else delta
        val newV = (state.amount + step).coerceAtLeast(0.0)
        state.amount = newV
        state.amountText = formatAmount(newV)
    }

    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp)) {
        Text(text = product.name, style = MaterialTheme.typography.bodyLarge, color = TextPrimary)
        product.brand?.let {
            Text(text = it, style = MaterialTheme.typography.bodySmall, color = TextSecondary)
        }

        Spacer(modifier = Modifier.height(6.dp))

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(
                modifier = Modifier
                    .size(30.dp)
                    .clip(CircleShape)
                    .background(TextPrimary.copy(alpha = 0.1f))
                    .clickable { applyDelta(-1.0) },
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Remove, contentDescription = "Decrease", tint = TextPrimary, modifier = Modifier.size(15.dp))
            }
            Text(
                text = state.portionText(product),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
                color = TextPrimary
            )
            Box(
                modifier = Modifier
                    .size(30.dp)
                    .clip(CircleShape)
                    .background(TextPrimary.copy(alpha = 0.1f))
                    .clickable { applyDelta(1.0) },
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Add, contentDescription = "Increase", tint = TextPrimary, modifier = Modifier.size(15.dp))
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        MacroColumns(
            summary = summary,
            fontSize = 14.sp,
            secondaryColor = TextSecondary,
            primaryColor = MaterialTheme.colorScheme.primary
        )

        Spacer(modifier = Modifier.height(12.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(0.8.dp)
                .background(SurfaceCardBorder.copy(alpha = 0.5f))
        )
    }
}
