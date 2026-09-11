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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Adjust
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Egg
import androidx.compose.material.icons.filled.Fastfood
import androidx.compose.material.icons.filled.Nightlife
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import com.evgarct.form.data.models.NutrientValue
import java.util.TimeZone
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evgarct.form.FormApp
import com.evgarct.form.R
import com.evgarct.form.data.models.FoodEntry
import com.evgarct.form.data.models.FoodQuantity
import com.evgarct.form.data.models.MealType
import com.evgarct.form.data.models.NutritionSummary
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

@Composable
fun MacroColumnsHeader() {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = stringResource(R.string.nutrition_fat_short).uppercase(),
            fontSize = 11.sp,
            color = Color.White.copy(alpha = 0.4f),
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
        Text(
            text = stringResource(R.string.nutrition_carbohydrates_short).uppercase(),
            fontSize = 11.sp,
            color = Color.White.copy(alpha = 0.4f),
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
        Text(
            text = stringResource(R.string.nutrition_protein_short).uppercase(),
            fontSize = 11.sp,
            color = Color.White.copy(alpha = 0.4f),
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
        Text(
            text = stringResource(R.string.summary_calories_unit).uppercase(),
            fontSize = 11.sp,
            color = Color.White.copy(alpha = 0.4f),
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
    }
}

@Composable
fun MacroColumns(
    summary: NutritionSummary,
    fontSize: androidx.compose.ui.unit.TextUnit = 14.sp,
    fontWeight: FontWeight = FontWeight.Normal
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = String.format(Locale.US, "%.0f", summary.fat),
            fontSize = fontSize,
            fontWeight = fontWeight,
            fontFamily = FontFamily.Monospace,
            color = Color.White.copy(alpha = 0.65f),
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
        Text(
            text = String.format(Locale.US, "%.0f", summary.carbohydrates),
            fontSize = fontSize,
            fontWeight = fontWeight,
            fontFamily = FontFamily.Monospace,
            color = Color.White.copy(alpha = 0.65f),
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
        Text(
            text = String.format(Locale.US, "%.0f", summary.protein),
            fontSize = fontSize,
            fontWeight = fontWeight,
            fontFamily = FontFamily.Monospace,
            color = Color.White.copy(alpha = 0.65f),
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
        Text(
            text = String.format(Locale.US, "%.0f", summary.calories),
            fontSize = fontSize,
            fontWeight = FontWeight.SemiBold,
            fontFamily = FontFamily.Monospace,
            color = Color.White,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
    }
}

@Composable
fun NutritionScreen(
    onOpenNutrientsSheet: (List<NutrientValue>) -> Unit,
    onOpenGoalsEditor: () -> Unit,
    onOpenAddProduct: (MealType, Date) -> Unit,
    onOpenEntryEditor: (FoodEntry) -> Unit
) {
    val nutritionRepo = FormApp.instance.nutritionRepository
    val prefs = FormApp.instance.appPreferences
    val scope = rememberCoroutineScope()

    var selectedDate by remember { mutableStateOf(Date()) }
    var entries by remember { mutableStateOf<List<FoodEntry>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    fun loadEntries() {
        isLoading = true
        scope.launch {
            nutritionRepo.getEntries(selectedDate, TimeZone.getDefault())
                .onSuccess {
                    entries = it
                    isLoading = false
                }
                .onFailure {
                    isLoading = false
                }
        }
    }

    LaunchedEffect(selectedDate) {
        loadEntries()
    }

    val daySummary = remember(entries) { NutritionSummary.fromEntries(entries) }
    val goals = prefs.nutritionGoals

    fun moveDay(offset: Int) {
        val cal = Calendar.getInstance().apply {
            time = selectedDate
            add(Calendar.DAY_OF_YEAR, offset)
        }
        selectedDate = cal.time
    }

    fun isToday(d: Date): Boolean {
        val cal1 = Calendar.getInstance().apply { time = d }
        val cal2 = Calendar.getInstance()
        return cal1.get(Calendar.YEAR) == cal2.get(Calendar.YEAR) &&
                cal1.get(Calendar.DAY_OF_YEAR) == cal2.get(Calendar.DAY_OF_YEAR)
    }

    val dateLabel = remember(selectedDate) {
        if (isToday(selectedDate)) {
            "Today"
        } else {
            SimpleDateFormat("d MMM", Locale.getDefault()).format(selectedDate)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.linearGradient(
                    listOf(
                        Color.Black,
                        Color(0xFF181410),
                        Color.Black
                    )
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .statusBarsPadding()
                .padding(horizontal = 18.dp)
                .padding(top = 16.dp, bottom = 110.dp),
            verticalArrangement = Arrangement.spacedBy(28.dp)
        ) {
            // Header: Date Capsule + Actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Glass Capsule Date Stepper
                Box(
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.12f))
                        .padding(horizontal = 6.dp, vertical = 4.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clickable { moveDay(-1) },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Previous Day",
                                tint = Color.White,
                                modifier = Modifier.size(16.dp)
                            )
                        }

                        Text(
                            text = dateLabel,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color.White,
                            modifier = Modifier.padding(horizontal = 12.dp)
                        )

                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clickable { moveDay(1) },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                                contentDescription = "Next Day",
                                tint = Color.White,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }

                // Goals Button
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.12f))
                        .clickable { onOpenGoalsEditor() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Adjust,
                        contentDescription = "Goals",
                        tint = Color.White,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }

            // Whole-day Total (Plain typography, NO BOX)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                MacroColumnsHeader()
                MacroColumns(
                    summary = daySummary,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.SemiBold
                )

                // Goal percentages if set
                if (goals.calories != null && goals.calories > 0) {
                    val calPercent = (daySummary.calories * 100 / goals.calories).toInt()
                    val pPercent = if (goals.protein != null && goals.protein > 0) (daySummary.protein * 100 / goals.protein).toInt() else null
                    val fPercent = if (goals.fat != null && goals.fat > 0) (daySummary.fat * 100 / goals.fat).toInt() else null
                    val cPercent = if (goals.carbohydrates != null && goals.carbohydrates > 0) (daySummary.carbohydrates * 100 / goals.carbohydrates).toInt() else null

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = fPercent?.let { "$it%" } ?: "",
                            fontSize = 12.sp,
                            color = Color.White.copy(alpha = 0.4f),
                            modifier = Modifier.weight(1f),
                            textAlign = TextAlign.End
                        )
                        Text(
                            text = cPercent?.let { "$it%" } ?: "",
                            fontSize = 12.sp,
                            color = Color.White.copy(alpha = 0.4f),
                            modifier = Modifier.weight(1f),
                            textAlign = TextAlign.End
                        )
                        Text(
                            text = pPercent?.let { "$it%" } ?: "",
                            fontSize = 12.sp,
                            color = Color.White.copy(alpha = 0.4f),
                            modifier = Modifier.weight(1f),
                            textAlign = TextAlign.End
                        )
                        Text(
                            text = "$calPercent%",
                            fontSize = 12.sp,
                            color = Color.White.copy(alpha = 0.4f),
                            modifier = Modifier.weight(1f),
                            textAlign = TextAlign.End
                        )
                    }
                }
            }

            // Meal Sections (Breakfast, Lunch, Dinner, Snack)
            MealType.values().forEach { meal ->
                val mealEntries = entries.filter { it.mealType == meal }
                val mealSummary = NutritionSummary.fromEntries(mealEntries)

                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Meal Header Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = meal.name.lowercase().replaceFirstChar { it.uppercase() },
                                fontSize = 20.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color.White
                            )
                        }

                        Row(verticalAlignment = Alignment.CenterVertically) {
                            // Add button (+)
                            Box(
                                modifier = Modifier
                                    .size(32.dp)
                                    .clip(CircleShape)
                                    .background(Color.White.copy(alpha = 0.12f))
                                    .clickable { onOpenAddProduct(meal, selectedDate) },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Add,
                                    contentDescription = "Add Food",
                                    tint = Color.White,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                    }

                    // Subtotal Macro row
                    if (mealEntries.isNotEmpty()) {
                        MacroColumns(
                            summary = mealSummary,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }

                    // Hairline separator
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(0.8.dp)
                            .background(Color.White.copy(alpha = 0.12f))
                    )

                    // Food Item Rows
                    if (mealEntries.isEmpty()) {
                        Text(
                            text = "No items logged",
                            fontSize = 14.sp,
                            color = Color.White.copy(alpha = 0.35f),
                            modifier = Modifier.padding(vertical = 6.dp)
                        )
                    } else {
                        mealEntries.forEach { entry ->
                            val itemSummary = NutritionSummary.fromNutrients(entry.productSnapshot.nutrients)
                            val quantityText = when (val q = entry.quantity) {
                                is FoodQuantity.Grams -> "${q.amount.toInt()} g"
                                is FoodQuantity.Milliliters -> "${q.amount.toInt()} ml"
                                is FoodQuantity.Pieces -> "${q.amount.toInt()} ${q.size}"
                                is FoodQuantity.Serving -> "${q.amount.toInt()} serv"
                                is FoodQuantity.AsConsumed -> ""
                            }

                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onOpenEntryEditor(entry) }
                                    .padding(vertical = 8.dp),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = entry.productSnapshot.name,
                                        fontSize = 16.sp,
                                        color = Color.White,
                                        modifier = Modifier.weight(1f),
                                        maxLines = 1
                                    )
                                    if (quantityText.isNotEmpty()) {
                                        Text(
                                            text = quantityText,
                                            fontSize = 13.sp,
                                            color = Color.White.copy(alpha = 0.55f),
                                            modifier = Modifier.padding(horizontal = 6.dp)
                                        )
                                    }
                                    Icon(
                                        imageVector = Icons.Default.ChevronRight,
                                        contentDescription = null,
                                        tint = Color.White.copy(alpha = 0.3f),
                                        modifier = Modifier.size(16.dp)
                                    )
                                }

                                if (itemSummary.calories > 0) {
                                    MacroColumns(
                                        summary = itemSummary,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Normal
                                    )
                                }
                            }

                            // Subtle divider between items
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(0.5.dp)
                                    .background(Color.White.copy(alpha = 0.08f))
                            )
                        }
                    }
                }
            }

            // All Nutrients Disclosure Row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onOpenNutrientsSheet(entries.flatMap { it.productSnapshot.nutrients }) }
                    .padding(vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = stringResource(R.string.nutrition_allnutrients),
                    fontSize = 16.sp,
                    color = Color.White.copy(alpha = 0.7f)
                )
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.3f),
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}
