package com.evgarct.form.ui.nutrition

import android.content.Intent
import androidx.compose.animation.AnimatedVisibility
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.IosShare
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.TrackChanges
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
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
import com.evgarct.form.data.models.FoodEntry
import com.evgarct.form.data.models.GoalStatus
import com.evgarct.form.data.models.MealType
import com.evgarct.form.data.models.NutrientValue
import com.evgarct.form.data.models.NutritionProduct
import com.evgarct.form.data.models.NutritionSummary
import com.evgarct.form.ui.components.GlassCard
import com.evgarct.form.ui.components.LoadingSpinner
import com.evgarct.form.ui.components.SerifNumber
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NutritionScreen(
    onOpenNutrientsSheet: (List<NutrientValue>) -> Unit,
    onOpenGoalsEditor: () -> Unit,
    onOpenAddProduct: (MealType, Date) -> Unit,
    onOpenEntryEditor: (FoodEntry) -> Unit
) {
    val context = LocalContext.current
    val nutritionRepo = FormApp.instance.nutritionRepository
    val prefs = FormApp.instance.appPreferences
    val scope = rememberCoroutineScope()

    var selectedDate by remember { mutableStateOf(Date()) }
    var entries by remember { mutableStateOf<List<FoodEntry>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var showDatePicker by remember { mutableStateOf(false) }

    // Meal collapse states
    val collapsedMeals = remember { mutableStateMapOf<MealType, Boolean>() }
    // Repeating states
    val repeatingMeals = remember { mutableStateMapOf<MealType, Boolean>() }

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
    val dateFormatter = remember { SimpleDateFormat("EEEE, d MMMM", Locale.getDefault()) }

    fun repeatPreviousMeal(mealType: MealType) {
        repeatingMeals[mealType] = true
        val cal = Calendar.getInstance().apply {
            time = selectedDate
            add(Calendar.DAY_OF_YEAR, -1)
        }
        val previousDay = cal.time

        scope.launch {
            nutritionRepo.repeatMeal(mealType, previousDay, selectedDate, TimeZone.getDefault())
                .onSuccess { newEntries ->
                    entries = (entries + newEntries).distinctBy { it.id }
                    repeatingMeals[mealType] = false
                }
                .onFailure {
                    repeatingMeals[mealType] = false
                }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Ink)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(top = 44.dp)
        ) {
            // Header Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                IconButton(onClick = {
                    val cal = Calendar.getInstance().apply {
                        time = selectedDate
                        add(Calendar.DAY_OF_YEAR, -1)
                    }
                    selectedDate = cal.time
                }) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Previous Day", tint = LightInk)
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.clickable { showDatePicker = true }
                ) {
                    Text(
                        text = dateFormatter.format(selectedDate),
                        style = MaterialTheme.typography.titleMedium,
                        color = LightInk
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Icon(
                        imageVector = Icons.Default.CalendarToday,
                        contentDescription = "Pick date",
                        tint = Trace,
                        modifier = Modifier.size(16.dp)
                    )
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = {
                        val cal = Calendar.getInstance().apply {
                            time = selectedDate
                            add(Calendar.DAY_OF_YEAR, 1)
                        }
                        selectedDate = cal.time
                    }) {
                        Icon(Icons.Default.ArrowForward, contentDescription = "Next Day", tint = LightInk)
                    }

                    IconButton(
                        onClick = {
                            // Quick text summary share
                            val shareText = buildString {
                                val lang = prefs.reportLanguage
                                val greeting = when (lang) {
                                    "ru" -> "Привет! Отчёт за ${dateFormatter.format(selectedDate)}"
                                    "cs" -> "Ahoj! Přehled za ${dateFormatter.format(selectedDate)}"
                                    else -> "Hello! Report for ${dateFormatter.format(selectedDate)}"
                                }
                                appendLine(greeting)
                                appendLine("Calories: ${daySummary.calories.toInt()} kcal")
                                appendLine("Protein: ${daySummary.protein.toInt()} g | Fat: ${daySummary.fat.toInt()} g | Carbs: ${daySummary.carbohydrates.toInt()} g")
                            }
                            val intent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_TEXT, shareText)
                            }
                            context.startActivity(Intent.createChooser(intent, "Share Nutrition Report"))
                        },
                        enabled = entries.isNotEmpty()
                    ) {
                        Icon(
                            imageVector = Icons.Default.IosShare,
                            contentDescription = "Share",
                            tint = if (entries.isNotEmpty()) Trace else TextMuted
                        )
                    }
                }
            }

            // Scrollable Content
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 8.dp)
            ) {
                // Day Macro Summary Card
                GlassCard(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp)
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "DAY TOTALS",
                                style = MaterialTheme.typography.labelSmall,
                                color = Trace
                            )
                            IconButton(
                                onClick = onOpenGoalsEditor,
                                modifier = Modifier.size(24.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.TrackChanges,
                                    contentDescription = "Goals",
                                    tint = Trace,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.Bottom
                        ) {
                            DayMacroItem("Fat", "${daySummary.fat.toInt()} g", goals.fat)
                            DayMacroItem("Carbs", "${daySummary.carbohydrates.toInt()} g", goals.carbohydrates)
                            DayMacroItem("Protein", "${daySummary.protein.toInt()} g", goals.protein)
                            DayMacroItem("Calories", "${daySummary.calories.toInt()} kcal", goals.calories, isEmphasis = true)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                if (isLoading) {
                    Box(modifier = Modifier.fillMaxWidth().height(150.dp), contentAlignment = Alignment.Center) {
                        LoadingSpinner()
                    }
                } else {
                    // Meal Sections
                    listOf(
                        MealType.BREAKFAST to "Breakfast",
                        MealType.LUNCH to "Lunch",
                        MealType.DINNER to "Dinner",
                        MealType.SNACK to "Snacks"
                    ).forEach { (type, label) ->
                        val mealEntries = entries.filter { it.mealType == type }
                        val isCollapsed = collapsedMeals[type] == true
                        val isRepeating = repeatingMeals[type] == true

                        MealSectionCard(
                            mealType = type,
                            title = label,
                            entries = mealEntries,
                            isCollapsed = isCollapsed,
                            isRepeating = isRepeating,
                            onToggleCollapse = { collapsedMeals[type] = !isCollapsed },
                            onRepeat = { repeatPreviousMeal(type) },
                            onAdd = { onOpenAddProduct(type, selectedDate) },
                            onEntryClick = { onOpenEntryEditor(it) }
                        )

                        Spacer(modifier = Modifier.height(16.dp))
                    }

                    // All Nutrients button
                    GlassCard(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                onOpenNutrientsSheet(entries.flatMap { it.productSnapshot.nutrients })
                            },
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(18.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "All nutrients",
                                style = MaterialTheme.typography.titleMedium,
                                color = LightInk
                            )
                            Icon(
                                imageVector = Icons.Default.ArrowForward,
                                contentDescription = null,
                                tint = Trace,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(80.dp))
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
    }
}

@Composable
fun DayMacroItem(
    label: String,
    value: String,
    goal: Double?,
    isEmphasis: Boolean = false
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = label, style = MaterialTheme.typography.bodySmall, color = TextMuted)
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = value,
            fontFamily = if (isEmphasis) FontFamily.Serif else FontFamily.Default,
            fontSize = if (isEmphasis) 22.sp else 16.sp,
            color = if (isEmphasis) Trace else LightInk,
            fontWeight = if (isEmphasis) FontWeight.Normal else FontWeight.Medium
        )
        if (goal != null && goal > 0) {
            val num = value.filter { it.isDigit() || it == '.' }.toDoubleOrNull() ?: 0.0
            val percent = ((num / goal) * 100).toInt()
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = "$percent%",
                fontSize = 11.sp,
                color = TextSecondary
            )
        }
    }
}

@Composable
fun MealSectionCard(
    mealType: MealType,
    title: String,
    entries: List<FoodEntry>,
    isCollapsed: Boolean,
    isRepeating: Boolean,
    onToggleCollapse: () -> Unit,
    onRepeat: () -> Unit,
    onAdd: () -> Unit,
    onEntryClick: (FoodEntry) -> Unit
) {
    GlassCard(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Section Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.clickable(onClick = onToggleCollapse)
                ) {
                    Icon(
                        imageVector = if (isCollapsed) Icons.Default.ExpandMore else Icons.Default.ExpandLess,
                        contentDescription = null,
                        tint = TextSecondary,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = title,
                        style = MaterialTheme.typography.titleMedium,
                        color = LightInk
                    )
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(
                        onClick = onRepeat,
                        enabled = !isRepeating,
                        modifier = Modifier.size(32.dp)
                    ) {
                        if (isRepeating) {
                            LoadingSpinner(size = 16.dp)
                        } else {
                            Icon(
                                imageVector = Icons.Default.Repeat,
                                contentDescription = "Repeat meal",
                                tint = Trace,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    IconButton(
                        onClick = onAdd,
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(Trace)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = "Add",
                            tint = LightInk,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }

            AnimatedVisibility(visible = !isCollapsed) {
                Column {
                    if (entries.isEmpty()) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "No items logged",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextMuted,
                            modifier = Modifier.padding(vertical = 4.dp)
                        )
                    } else {
                        Spacer(modifier = Modifier.height(12.dp))
                        entries.forEachIndexed { index, entry ->
                            LoggedEntryRow(entry = entry, onClick = { onEntryClick(entry) })
                            if (index < entries.size - 1) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(1.dp)
                                        .background(SurfaceCardBorder.copy(alpha = 0.5f))
                                        .padding(vertical = 4.dp)
                                )
                            }
                        }

                        // Meal subtotal
                        val mealSummary = NutritionSummary.fromEntries(entries)
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(SurfaceCardBorder.copy(alpha = 0.3f))
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(text = "Subtotal", style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                            Text(
                                text = "${mealSummary.calories.toInt()} kcal (${mealSummary.protein.toInt()}p/${mealSummary.fat.toInt()}f/${mealSummary.carbohydrates.toInt()}c)",
                                style = MaterialTheme.typography.bodySmall,
                                color = LightInk,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun LoggedEntryRow(entry: FoodEntry, onClick: () -> Unit) {
    val summary = NutritionSummary.fromNutrients(entry.productSnapshot.nutrients)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(text = entry.productSnapshot.name, style = MaterialTheme.typography.bodyMedium, color = LightInk)
            val qtyStr = "${entry.quantity.amount.let { if (it % 1.0 == 0.0) it.toInt().toString() else it.toString() }} ${entry.quantity.unitLabel}"
            Text(text = qtyStr, style = MaterialTheme.typography.bodySmall, color = TextMuted)
        }

        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = "${summary.calories.toInt()} kcal",
                style = MaterialTheme.typography.bodyMedium,
                color = Trace,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = "${summary.protein.toInt()}p / ${summary.fat.toInt()}f / ${summary.carbohydrates.toInt()}c",
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondary
            )
        }
    }
}
