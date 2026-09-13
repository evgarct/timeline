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
import androidx.compose.ui.graphics.Brush
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
import com.evgarct.form.core.theme.Ink
import com.evgarct.form.core.theme.OrangeAccent
import com.evgarct.form.core.theme.RedAccent
import com.evgarct.form.core.theme.SurfaceCard
import com.evgarct.form.core.theme.SurfaceCardBorder
import com.evgarct.form.core.theme.SurfaceCardHighlight
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
fun MacroColumnsHeader() {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = stringResource(R.string.nutrition_protein_short).uppercase(),
            fontSize = 11.sp,
            color = TextMuted,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
        Text(
            text = stringResource(R.string.nutrition_fat_short).uppercase(),
            fontSize = 11.sp,
            color = TextMuted,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
        Text(
            text = stringResource(R.string.nutrition_carbohydrates_short).uppercase(),
            fontSize = 11.sp,
            color = TextMuted,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
        Text(
            text = stringResource(R.string.summary_calories_unit).uppercase(),
            fontSize = 11.sp,
            color = TextMuted,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
    }
}

@Composable
fun MacroColumns(
    summary: NutritionSummary,
    fontSize: TextUnit = 14.sp,
    fontWeight: FontWeight = FontWeight.Normal
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
            color = TextSecondary,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
        Text(
            text = String.format(Locale.US, "%.0f", summary.fat),
            fontSize = fontSize,
            fontWeight = fontWeight,
            fontFamily = FontFamily.Monospace,
            color = TextSecondary,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
        Text(
            text = String.format(Locale.US, "%.0f", summary.carbohydrates),
            fontSize = fontSize,
            fontWeight = fontWeight,
            fontFamily = FontFamily.Monospace,
            color = TextSecondary,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
        Text(
            text = String.format(Locale.US, "%.0f", summary.calories),
            fontSize = fontSize,
            fontWeight = FontWeight.SemiBold,
            fontFamily = FontFamily.Monospace,
            color = TextPrimary,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.End
        )
    }
}

private fun goalStatusColor(status: GoalStatus): Color = when (status) {
    is GoalStatus.OnTarget -> GreenAccent
    is GoalStatus.Under -> TextMuted
    is GoalStatus.Over -> OrangeAccent
}

@Composable
private fun GoalPercentCell(actual: Double, goal: Double?, modifier: Modifier) {
    if (goal == null || goal <= 0) {
        Box(modifier = modifier)
        return
    }
    val percent = (actual * 100 / goal).toInt()
    val color = goalStatusColor(GoalStatus.compute(actual, goal))
    Text(
        text = "$percent%",
        fontSize = 12.sp,
        fontWeight = FontWeight.Medium,
        color = color,
        modifier = modifier,
        textAlign = TextAlign.End
    )
}

@Composable
private fun GoalPercentRow(daySummary: NutritionSummary, goals: StoredNutritionGoals) {
    val hasAnyGoal = listOf(goals.calories, goals.protein, goals.fat, goals.carbohydrates).any { it != null && it > 0 }
    if (!hasAnyGoal) return
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        GoalPercentCell(daySummary.protein, goals.protein, Modifier.weight(1f))
        GoalPercentCell(daySummary.fat, goals.fat, Modifier.weight(1f))
        GoalPercentCell(daySummary.carbohydrates, goals.carbohydrates, Modifier.weight(1f))
        GoalPercentCell(daySummary.calories, goals.calories, Modifier.weight(1f))
    }
}

private fun mealLabelRes(meal: MealType): Int = when (meal) {
    MealType.BREAKFAST -> R.string.nutrition_meal_breakfast
    MealType.LUNCH -> R.string.nutrition_meal_lunch
    MealType.DINNER -> R.string.nutrition_meal_dinner
    MealType.SNACK -> R.string.nutrition_meal_snack
}

@Composable
private fun HairlineDivider(alpha: Float = 0.5f) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(0.8.dp)
            .background(SurfaceCardBorder.copy(alpha = alpha))
    )
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
private fun FoodEntryRow(
    entry: FoodEntry,
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
                    .clip(RoundedCornerShape(12.dp))
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
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(
                imageVector = meal.icon,
                contentDescription = null,
                tint = TextSecondary,
                modifier = Modifier.size(20.dp)
            )
            Text(
                text = stringResource(mealLabelRes(meal)),
                fontSize = 19.sp,
                fontWeight = FontWeight.SemiBold,
                color = TextPrimary
            )
        }

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(SurfaceCard)
                    .clickable(onClick = onAdd),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = stringResource(R.string.nutrition_add),
                    tint = TextPrimary,
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
            .background(
                Brush.linearGradient(
                    listOf(Ink, SurfaceCard, Ink)
                )
            )
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
                verticalArrangement = Arrangement.spacedBy(28.dp)
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
                                .background(SurfaceCard)
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
                                .background(SurfaceCard)
                                .clickable { onOpenGoalsEditor() },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Adjust,
                                contentDescription = stringResource(R.string.nutrition_goals_edit),
                                tint = TextPrimary,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }

                item(key = "day-total") {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(20.dp))
                            .background(SurfaceCardHighlight)
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        MacroColumnsHeader()
                        MacroColumns(summary = daySummary, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
                        GoalPercentRow(daySummary = daySummary, goals = goals)
                    }
                }

                MealType.values().forEach { meal ->
                    item(key = meal.name) {
                        val mealEntries = entries.filter { it.mealType == meal }
                        val mealSummary = remember(mealEntries) { NutritionSummary.fromEntries(mealEntries) }
                        val expanded = meal.name !in viewModel.collapsedMeals

                        Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
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
                                    }
                                    HairlineDivider()
                                    if (mealEntries.isEmpty()) {
                                        Text(
                                            text = stringResource(R.string.nutrition_meal_empty),
                                            fontSize = 14.sp,
                                            color = TextMuted,
                                            modifier = Modifier.padding(vertical = 6.dp)
                                        )
                                    } else {
                                        mealEntries.forEachIndexed { index, entry ->
                                            FoodEntryRow(
                                                entry = entry,
                                                onOpen = { onOpenEntryEditor(entry) },
                                                onRepeat = { viewModel.repeatEntry(entry) },
                                                onDelete = { triggerDelete(entry) }
                                            )
                                            if (index != mealEntries.lastIndex) {
                                                HairlineDivider(alpha = 0.3f)
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
                            .clickable { onOpenNutrientsSheet(entries.flatMap { it.productSnapshot.nutrients }) }
                            .padding(vertical = 12.dp),
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
