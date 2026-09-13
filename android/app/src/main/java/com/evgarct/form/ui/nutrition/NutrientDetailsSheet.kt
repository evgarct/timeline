package com.evgarct.form.ui.nutrition

import androidx.compose.foundation.background
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BakeryDining
import androidx.compose.material.icons.filled.Diamond
import androidx.compose.material.icons.filled.Grain
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.LocalPharmacy
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.OilBarrel
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evgarct.form.core.theme.TextMuted
import com.evgarct.form.core.theme.TextPrimary
import com.evgarct.form.data.models.NutrientProvenance
import com.evgarct.form.data.models.NutrientValue
import com.evgarct.form.ui.nutrition.components.FormModalSheet
import java.util.Locale

private fun groupIcon(groupTitle: String): ImageVector = when (groupTitle) {
    "Energy & Protein" -> Icons.Default.LocalFireDepartment
    "Fats" -> Icons.Default.OilBarrel
    "Carbohydrates, Sugars & Fiber" -> Icons.Default.BakeryDining
    "Salt & Sodium" -> Icons.Default.Grain
    "Vitamins" -> Icons.Default.LocalPharmacy
    "Minerals" -> Icons.Default.Diamond
    else -> Icons.Default.MoreHoriz
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NutrientDetailsSheet(
    title: String = "All nutrients",
    nutrients: List<NutrientValue>,
    onDismiss: () -> Unit
) {
    val aggregated = aggregateNutrients(nutrients)
    val grouped = groupNutrients(aggregated)
    val colorScheme = MaterialTheme.colorScheme

    FormModalSheet(onDismissRequest = onDismiss, title = title) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = 560.dp)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
        ) {
            grouped.forEach { (groupTitle, list) ->
                if (list.isNotEmpty()) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.padding(top = 20.dp, bottom = 10.dp)
                    ) {
                        Icon(
                            imageVector = groupIcon(groupTitle),
                            contentDescription = null,
                            tint = colorScheme.primary,
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text = groupTitle.uppercase(),
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = 0.8.sp,
                            color = colorScheme.primary
                        )
                    }

                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(20.dp))
                            .background(colorScheme.surfaceContainer)
                    ) {
                        list.forEachIndexed { index, nutrient ->
                            NutrientRow(nutrient = nutrient)
                            if (index < list.size - 1) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 16.dp)
                                        .height(0.8.dp)
                                        .background(colorScheme.outlineVariant.copy(alpha = 0.5f))
                                )
                            }
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
fun NutrientRow(nutrient: NutrientValue) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = nutrient.label,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
                color = TextPrimary
            )
            if (nutrient.provenance != NutrientProvenance.STATED) {
                val provText = if (nutrient.provenance == NutrientProvenance.ESTIMATED) "Estimated" else "Calculated"
                Text(
                    text = provText,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextMuted
                )
            }
        }

        val formattedValue = nutrient.value?.let { v ->
            val prefix = nutrient.qualifier ?: ""
            val numberText = if (v == Math.floor(v)) {
                String.format(Locale.US, "%.0f", v)
            } else {
                String.format(Locale.US, "%.1f", v)
            }
            "$prefix$numberText ${nutrient.unit}".trim()
        } ?: nutrient.originalText ?: "—"

        Text(
            text = formattedValue,
            style = MaterialTheme.typography.bodyLarge,
            fontFamily = FontFamily.Monospace,
            color = TextPrimary.copy(alpha = 0.85f)
        )
    }
}

fun aggregateNutrients(values: List<NutrientValue>): List<NutrientValue> {
    return values.groupBy { "${it.key ?: it.label}-${it.unit}" }.values.map { group ->
        val first = group[0]
        val total = group.mapNotNull { it.value }.takeIf { it.isNotEmpty() }?.sum()
        val prov = when {
            group.any { it.provenance == NutrientProvenance.ESTIMATED } -> NutrientProvenance.ESTIMATED
            group.any { it.provenance == NutrientProvenance.CALCULATED } -> NutrientProvenance.CALCULATED
            else -> NutrientProvenance.STATED
        }
        first.copy(value = total, provenance = prov)
    }
}

fun groupNutrients(values: List<NutrientValue>): List<Pair<String, List<NutrientValue>>> {
    val order = listOf(
        "Energy & Protein",
        "Fats",
        "Carbohydrates, Sugars & Fiber",
        "Salt & Sodium",
        "Vitamins",
        "Minerals",
        "Other"
    )

    val map = values.groupBy { nutrient ->
        val key = nutrient.key ?: ""
        when {
            key in listOf("energy_kcal", "protein") -> "Energy & Protein"
            key.contains("fat") || key == "cholesterol" -> "Fats"
            key.contains("carbohydrate") || key.contains("sugar") || key == "fiber" -> "Carbohydrates, Sugars & Fiber"
            key in listOf("salt", "sodium") -> "Salt & Sodium"
            key.startsWith("vitamin") -> "Vitamins"
            key in listOf("potassium", "calcium", "iron", "magnesium", "zinc", "phosphorus", "iodine", "selenium") -> "Minerals"
            else -> "Other"
        }
    }

    return order.map { it to (map[it] ?: emptyList()) }
}
