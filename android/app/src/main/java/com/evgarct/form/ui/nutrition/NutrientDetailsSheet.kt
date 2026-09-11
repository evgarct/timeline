package com.evgarct.form.ui.nutrition

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evgarct.form.data.models.NutrientProvenance
import com.evgarct.form.data.models.NutrientValue
import java.util.Locale

@Composable
fun NutrientDetailsSheet(
    title: String = "All Nutrients",
    nutrients: List<NutrientValue>,
    onDismiss: () -> Unit
) {
    val aggregated = aggregateNutrients(nutrients)
    val grouped = groupNutrients(aggregated)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF13110E))
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .padding(top = 10.dp)
        ) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 22.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = title,
                    fontSize = 32.sp,
                    fontFamily = FontFamily.Serif,
                    letterSpacing = (-0.8).sp,
                    color = Color.White
                )

                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.12f))
                        .clickable { onDismiss() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Close",
                        tint = Color.White,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 22.dp, vertical = 8.dp)
            ) {
                grouped.forEach { (groupTitle, list) ->
                    if (list.isNotEmpty()) {
                        Text(
                            text = groupTitle.uppercase(),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = 1.2.sp,
                            color = Color.White.copy(alpha = 0.4f),
                            modifier = Modifier.padding(top = 24.dp, bottom = 10.dp)
                        )

                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color.White.copy(alpha = 0.05f))
                        ) {
                            list.forEachIndexed { index, nutrient ->
                                NutrientRow(nutrient = nutrient)
                                if (index < list.size - 1) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 16.dp)
                                            .height(1.dp)
                                            .background(Color.White.copy(alpha = 0.06f))
                                    )
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
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = nutrient.label,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = Color.White
            )
            if (nutrient.provenance != NutrientProvenance.STATED) {
                val provText = if (nutrient.provenance == NutrientProvenance.ESTIMATED) "Estimated" else "Calculated"
                Text(
                    text = provText,
                    fontSize = 12.sp,
                    color = Color.White.copy(alpha = 0.4f)
                )
            }
        }

        val formattedValue = nutrient.value?.let { v ->
            val prefix = nutrient.qualifier ?: ""
            "$prefix${String.format(Locale.US, "%.1f", v)} ${nutrient.unit}".trim()
        } ?: nutrient.originalText ?: "—"

        Text(
            text = formattedValue,
            fontSize = 15.sp,
            fontFamily = FontFamily.Monospace,
            color = Color.White.copy(alpha = 0.75f)
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
