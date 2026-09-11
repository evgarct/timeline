package com.evgarct.form.ui.nutrition

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.evgarct.form.core.theme.Ink
import com.evgarct.form.core.theme.LightInk
import com.evgarct.form.core.theme.TextMuted
import com.evgarct.form.core.theme.TextSecondary
import com.evgarct.form.core.theme.Trace
import com.evgarct.form.data.models.NutrientProvenance
import com.evgarct.form.data.models.NutrientValue
import com.evgarct.form.ui.components.GlassCard
import java.util.Locale

@Composable
fun NutrientDetailsSheet(
    title: String = "All Nutrients",
    nutrients: List<NutrientValue>,
    onDismiss: () -> Unit
) {
    // Group nutrients in fixed order: Macros -> Fats -> Carbohydrates -> Salt -> Vitamins -> Minerals -> Other
    val aggregated = aggregateNutrients(nutrients)
    val grouped = groupNutrients(aggregated)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Ink)
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
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    color = LightInk
                )

                IconButton(onClick = onDismiss) {
                    Icon(imageVector = Icons.Default.Close, contentDescription = "Close", tint = LightInk)
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 8.dp)
            ) {
                grouped.forEach { (groupTitle, list) ->
                    if (list.isNotEmpty()) {
                        Text(
                            text = groupTitle.uppercase(),
                            style = MaterialTheme.typography.labelMedium,
                            color = Trace,
                            modifier = Modifier.padding(top = 16.dp, bottom = 8.dp)
                        )

                        GlassCard(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                                list.forEachIndexed { index, nutrient ->
                                    NutrientRow(nutrient = nutrient)
                                    if (index < list.size - 1) {
                                        Spacer(modifier = Modifier.height(8.dp))
                                    }
                                }
                            }
                        }
                    }
                }
                Spacer(modifier = Modifier.height(40.dp))
            }
        }
    }
}

@Composable
fun NutrientRow(nutrient: NutrientValue) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(text = nutrient.label, style = MaterialTheme.typography.bodyMedium, color = LightInk)
            if (nutrient.provenance != NutrientProvenance.STATED) {
                val provText = if (nutrient.provenance == NutrientProvenance.ESTIMATED) "Estimated" else "Calculated"
                Text(text = provText, style = MaterialTheme.typography.bodySmall, color = TextMuted)
            }
        }

        val formattedValue = nutrient.value?.let { v ->
            val prefix = nutrient.qualifier ?: ""
            "$prefix${String.format(Locale.US, "%.1f", v)} ${nutrient.unit}".trim()
        } ?: nutrient.originalText ?: "—"

        Text(text = formattedValue, style = MaterialTheme.typography.bodyMedium, color = TextSecondary)
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
