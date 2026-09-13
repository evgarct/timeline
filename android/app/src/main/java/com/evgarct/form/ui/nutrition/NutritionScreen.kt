package com.evgarct.form.ui.nutrition

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Adjust
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.evgarct.form.FormApp
import com.evgarct.form.R
import com.evgarct.form.core.preferences.StoredNutritionGoals
import com.evgarct.form.core.theme.GreenAccent
import com.evgarct.form.core.theme.OrangeAccent
import com.evgarct.form.core.theme.RedAccent
import com.evgarct.form.core.theme.TextMuted
import com.evgarct.form.core.theme.TextPrimary
import com.evgarct.form.core.theme.TextSecondary
import com.evgarct.form.data.models.FoodEntry
import com.evgarct.form.data.models.FoodQuantity
import com.evgarct.form.data.models.GoalStatus
import com.evgarct.form.data.models.MealType
import com.evgarct.form.data.models.NutrientValue
import com.evgarct.form.data.models.NutritionSummary
import com.evgarct.form.data.models.icon
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

@Composable
fun MacroColumnsHeader(color: Color = TextMuted) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = stringResource(R.string.nutrition_protein_short).uppercase(),
            fontSize = 11.sp,
            color = color,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
        Text(
            text = stringResource(R.string.nutrition_fat_short).uppercase(),
            fontSize = 11.sp,
            color = color,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
        Text(
            text = stringResource(R.string.nutrition_carbohydrates_short).uppercase(),
            fontSize = 11.sp,
            color = color,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
        Text(
            text = stringResource(R.string.summary_calories_unit).uppercase(),
            fontSize = 11.sp,
            color = color,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
    }
}

@Composable
fun MacroColumns(
    summary: NutritionSummary,
    fontSize: TextUnit = 14.sp,
    fontWeight: FontWeight = FontWeight.Normal,
    secondaryColor: Color = TextSecondary,
    primaryColor: Color = TextPrimary
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = String.format(Locale.US, "%.0f", summary.protein),
            fontSize = fontSize,
            fontWeight = fontWeight,
            fontFamily = FontFamily.Monospace,
            color = secondaryColor,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
        Text(
            text = String.format(Locale.US, "%.0f", summary.fat),
            fontSize = fontSize,
            fontWeight = fontWeight,
            fontFamily = FontFamily.Monospace,
            color = secondaryColor,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
        Text(
            text = String.format(Locale.US, "%.0f", summary.carbohydrates),
            fontSize = fontSize,
            fontWeight = fontWeight,
            fontFamily = FontFamily.Monospace,
            color = secondaryColor,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
        Text(
            text = String.format(Locale.US, "%.0f", summary.calories),
            fontSize = fontSize,
            fontWeight = FontWeight.SemiBold,
            fontFamily = FontFamily.Monospace,
            color = primaryColor,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
    }
}

private fun goalStatusColor(status: GoalStatus, neutralColor: Color): Color = when (status) {
    is GoalStatus.OnTarget -> GreenAccent
    is GoalStatus.Under -> neutralColor
    is GoalStatus.Over -> OrangeAccent
}

@Composable
private fun GoalPercentCell(actual: Double, goal: Double?, neutralColor: Color, chipColor: Color, modifier: Modifier) {
    if (goal == null || goal <= 0) {
        Box(modifier = modifier)
        return
    }
    val percent = (actual * 100 / goal).toInt()
    val color = goalStatusColor(GoalStatus.compute(actual, goal), neutralColor)
    Box(modifier = modifier, contentAlignment = Alignment.CenterEnd) {
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(chipColor)
                .padding(horizontal = 8.dp, vertical = 2.dp)
        ) {
            Text(
                text = "$percent%",
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = color
            )
        }
    }
}

@Composable
private fun GoalPercentRow(daySummary: NutritionSummary, goals: StoredNutritionGoals, neutralColor: Color, chipColor: Color) {
    val hasAnyGoal = listOf(goals.calories, goals.protein, goals.fat, goals.carbohydrates).any { it != null && it > 0 }
    if (!hasAnyGoal) return
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        GoalPercentCell(daySummary.protein, goals.protein, neutralColor, chipColor, Modifier.weight(1f))
        GoalPercentCell(daySummary.fat, goals.fat, neutralColor, chipColor, Modifier.weight(1f))
        GoalPercentCell(daySummary.carbohydrates, goals.carbohydrates, neutralColor, chipColor, Modifier.weight(1f))
        GoalPercentCell(daySummary.calories, goals.calories, neutralColor, chipColor, Modifier.weight(1f))
    }
}

private fun mealLabelRes(meal: MealType): Int = when (meal) {
    MealType.BREAKFAST -> R.string.nutrition_meal_breakfast
    MealType.LUNCH -> R.string.nutrition_meal_lunch
    MealType.DINNER -> R.string.nutrition_meal_dinner
    MealType.SNACK -> R.string.nutrition_meal_snack
}

@Composable
private fun HairlineDivider(color: Color, alpha: Float = 0.6f) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(0.8.dp)
            .background(color.copy(alpha = alpha))
    )
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
private fun FoodEntryRow(
    entry: FoodEntry,
    cardColor: Color,
    onOpen: () -> Unit,
    onRepeat: () -> Unit,
    onDelete: () -> Unit
) {
    var showMenu by remember { mutableStateOf(false) }
    val itemSummary = remember(entry) { NutritionSummary.fromNutrients(entry.productSnapshot.nutrients) }
    val quantityText = remember(entry) {
        when (val q = entry.quantity) {
            is FoodQuantity.Grams -> "${q.amount.toInt()} g"
            is FoodQuantity.Milliliters -> "${q.amount.toInt()} ml"
            is FoodQuantity.Pieces -> "${q.amount.toInt()} ${q.size}"
            is FoodQuantity.Serving -> "${q.amount.toInt()} serv"
            is FoodQuantity.AsConsumed -> ""
        }
    }

    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { value ->
            if (value == SwipeToDismissBoxValue.EndToStart) {
                onDelete()
                true
            } else {
                false
            }
        }
    )

    SwipeToDismissBox(
        state = dismissState,
        enableDismissFromStartToEnd = false,
        backgroundContent = {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clip(RoundedCornerShape(16.dp))
                    .background(RedAccent.copy(alpha = 0.85f))
                    .padding(horizontal = 18.dp),
                contentAlignment = Alignment.CenterEnd
            ) {
                Icon(imageVector = Icons.Default.Delete, contentDescription = null, tint = TextPrimary)
            }
        }
    ) {
        Box {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(cardColor)
                    .combinedClickable(onClick = onOpen, onLongClick = { showMenu = true })
                    .padding(vertical = 10.dp),
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
                        color = TextPrimary,
                        modifier = Modifier.weight(1f),
                        maxLines = 1
                    )
                    if (quantityText.isNotEmpty()) {
                        Text(
                            text = quantityText,
                            fontSize = 13.sp,
                            color = TextSecondary,
                            modifier = Modifier.padding(horizontal = 6.dp)
                        )
                    }
                    Icon(
                        imageVector = Icons.Default.ChevronRight,
                        contentDescription = null,
                        tint = TextMuted,
                        modifier = Modifier.size(16.dp)
                    )
                }

                if (itemSummary.calories > 0) {
                    MacroColumns(summary = itemSummary, fontSize = 12.sp, fontWeight = FontWeight.Normal)
                }
            }

            DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.nutrition_edit)) },
                    leadingIcon = { Icon(Icons.Default.Edit, contentDescription = null) },
                    onClick = { showMenu = false; onOpen() }
                )
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.nutrition_repeat)) },
                    leadingIcon = { Icon(Icons.Default.Repeat, contentDescription = null) },
                    onClick = { showMenu = false; onRepeat() }
                )
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.nutrition_delete)) },
                    leadingIcon = { Icon(Icons.Default.Delete, contentDescription = null) },
                    onClick = { showMenu = false; onDelete() }
                )
            }
        }
    }
}

@Composable
private fun MealSectionHeader(
    meal: MealType,
    expanded: Boolean,
    onToggleExpand: () -> Unit,
    onAdd: () -> Unit
) {
    val chevronRotation by animateFloatAsState(targetValue = if (expanded) 0f else -90f, label = "chevron")
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onToggleExpand),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.secondaryContainer),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = meal.icon,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSecondaryContainer,
                    modifier = Modifier.size(18.dp)
                )
            }
            Text(
                text = stringResource(mealLabelRes(meal)),
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = TextPrimary
            )
        }

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.tertiaryContainer)
                    .clickable(onClick = onAdd),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = stringResource(R.string.nutrition_add),
                    tint = MaterialTheme.colorScheme.onTertiaryContainer,
                    modifier = Modifier.size(18.dp)
                )
            }
            Icon(
                imageVector = Icons.Default.ExpandMore,
                contentDescription = null,
                tint = TextMuted,
                modifier = Modifier
                    .size(28.dp)
                    .rotate(chevronRotation)
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NutritionScreen(
    onOpenNutrientsSheet: (List<NutrientValue>) -> Unit,
    onOpenGoalsEditor: () -> Unit,
    onOpenAddProduct: (MealType, Date) -> Unit,
    onOpenEntryEditor: (FoodEntry) -> Unit
) {
    val prefs = FormApp.instance.appPreferences
    val scope = rememberCoroutineScope()
    val viewModel: NutritionViewModel = viewModel()
    val snackbarHostState = remember { SnackbarHostState() }
    val timezone = remember { TimeZone.getDefault() }
    val colorScheme = MaterialTheme.colorScheme

    var selectedDate by remember { mutableStateOf(Date()) }
    val cacheMap by viewModel.cacheState.collectAsState()
    val dayState = remember(cacheMap, selectedDate) { viewModel.dayState(selectedDate, timezone) }
    val entries = dayState.entries
    val entryRemovedMessage = stringResource(R.string.nutrition_entry_removed)
    val undoLabel = stringResource(R.string.nutrition_undo)

    LaunchedEffect(selectedDate) {
        viewModel.refresh(selectedDate, timezone)
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

    fun triggerDelete(entry: FoodEntry) {
        viewModel.beginPendingDelete(entry, selectedDate, timezone)
        scope.launch {
            val result = snackbarHostState.showSnackbar(
                message = entryRemovedMessage,
                actionLabel = undoLabel,
                duration = SnackbarDuration.Short
            )
            if (result == SnackbarResult.ActionPerformed) {
                viewModel.undoDelete()
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colorScheme.surface)
    ) {
        Scaffold(
            containerColor = Color.Transparent,
            contentWindowInsets = WindowInsets(0, 0, 0, 0),
            snackbarHost = { SnackbarHost(snackbarHostState) }
        ) { padding ->
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .statusBarsPadding(),
                contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 110.dp),
                verticalArrangement = Arrangement.spacedBy(24.dp)
            ) {
                item(key = "header") {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .clip(CircleShape)
                                .background(colorScheme.surfaceContainerHigh)
                                .padding(horizontal = 6.dp, vertical = 4.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(32.dp)
                                        .clip(CircleShape)
                                        .clickable { moveDay(-1) },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                        contentDescription = stringResource(R.string.nutrition_previousday),
                                        tint = TextPrimary,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }

                                Text(
                                    text = dateLabel,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = TextPrimary,
                                    modifier = Modifier.padding(horizontal = 12.dp)
                                )

                                Box(
                                    modifier = Modifier
                                        .size(32.dp)
                                        .clip(CircleShape)
                                        .clickable { moveDay(1) },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                                        contentDescription = stringResource(R.string.nutrition_nextday),
                                        tint = TextPrimary,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            }
                        }

                        Box(
                            modifier = Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(colorScheme.secondaryContainer)
                                .clickable { onOpenGoalsEditor() },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Adjust,
                                contentDescription = stringResource(R.string.nutrition_goals_edit),
                                tint = colorScheme.onSecondaryContainer,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }

                item(key = "day-total") {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(28.dp))
                            .background(colorScheme.primaryContainer)
                            .padding(horizontal = 20.dp, vertical = 18.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        MacroColumnsHeader(color = colorScheme.onPrimaryContainer.copy(alpha = 0.6f))
                        MacroColumns(
                            summary = daySummary,
                            fontSize = 26.sp,
                            fontWeight = FontWeight.SemiBold,
                            secondaryColor = colorScheme.onPrimaryContainer.copy(alpha = 0.75f),
                            primaryColor = colorScheme.onPrimaryContainer
                        )
                        GoalPercentRow(
                            daySummary = daySummary,
                            goals = goals,
                            neutralColor = colorScheme.onPrimaryContainer.copy(alpha = 0.75f),
                            chipColor = colorScheme.onPrimaryContainer.copy(alpha = 0.14f)
                        )
                    }
                }

                MealType.values().forEach { meal ->
                    item(key = meal.name) {
                        val mealEntries = entries.filter { it.mealType == meal }
                        val mealSummary = remember(mealEntries) { NutritionSummary.fromEntries(mealEntries) }
                        val expanded = meal.name !in viewModel.collapsedMeals

                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(24.dp))
                                .background(colorScheme.surfaceContainer)
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            MealSectionHeader(
                                meal = meal,
                                expanded = expanded,
                                onToggleExpand = { viewModel.toggleMealCollapsed(meal) },
                                onAdd = { onOpenAddProduct(meal, selectedDate) }
                            )

                            AnimatedVisibility(visible = expanded) {
                                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                    if (mealEntries.isNotEmpty()) {
                                        MacroColumns(summary = mealSummary, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                                        HairlineDivider(color = colorScheme.outlineVariant)
                                    }
                                    if (mealEntries.isEmpty()) {
                                        Text(
                                            text = stringResource(R.string.nutrition_meal_empty),
                                            fontSize = 14.sp,
                                            color = TextMuted,
                                            modifier = Modifier.padding(vertical = 6.dp)
                                        )
                                    } else {
                                        Column(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(16.dp))
                                        ) {
                                            mealEntries.forEachIndexed { index, entry ->
                                                FoodEntryRow(
                                                    entry = entry,
                                                    cardColor = colorScheme.surfaceContainer,
                                                    onOpen = { onOpenEntryEditor(entry) },
                                                    onRepeat = { viewModel.repeatEntry(entry) },
                                                    onDelete = { triggerDelete(entry) }
                                                )
                                                if (index != mealEntries.lastIndex) {
                                                    HairlineDivider(color = colorScheme.outlineVariant, alpha = 0.4f)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                item(key = "all-nutrients") {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(20.dp))
                            .background(colorScheme.surfaceContainer)
                            .clickable { onOpenNutrientsSheet(entries.flatMap { it.productSnapshot.nutrients }) }
                            .padding(horizontal = 20.dp, vertical = 16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = stringResource(R.string.nutrition_allnutrients),
                            fontSize = 16.sp,
                            color = TextSecondary
                        )
                        Icon(
                            imageVector = Icons.Default.ChevronRight,
                            contentDescription = null,
                            tint = TextMuted,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }
    }
}
