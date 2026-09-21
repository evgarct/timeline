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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evgarct.form.FormApp
import com.evgarct.form.core.theme.TextMuted
import com.evgarct.form.core.theme.TextPrimary
import com.evgarct.form.core.theme.TextSecondary
import com.evgarct.form.data.models.FoodQuantity
import com.evgarct.form.data.models.MealType
import com.evgarct.form.data.models.NutritionProduct
import com.evgarct.form.ui.components.LoadingSpinner
import com.evgarct.form.ui.nutrition.components.FormModalSheet
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductSearchSheet(
    mealType: MealType,
    onDismiss: () -> Unit,
    onSelectProduct: (NutritionProduct) -> Unit,
    onSelectMultiple: (List<NutritionProduct>) -> Unit,
    onOpenBarcodeScanner: () -> Unit
) {
    val nutritionRepo = FormApp.instance.nutritionRepository
    val colorScheme = MaterialTheme.colorScheme

    var query by remember { mutableStateOf("") }
    var searchResults by remember { mutableStateOf<List<NutritionProduct>>(emptyList()) }
    var recentForMeal by remember { mutableStateOf<List<NutritionProduct>>(emptyList()) }
    var recentForMealQuantities by remember { mutableStateOf<Map<String, FoodQuantity>>(emptyMap()) }
    var moreRecent by remember { mutableStateOf<List<NutritionProduct>>(emptyList()) }
    var isSearching by remember { mutableStateOf(false) }
    var isLoadingRecents by remember { mutableStateOf(true) }

    var selectionMode by remember { mutableStateOf(false) }
    var selectedProducts by remember { mutableStateOf<List<NutritionProduct>>(emptyList()) }

    fun isProductSelected(product: NutritionProduct) = selectedProducts.any { it.id == product.id }

    fun toggleSelected(product: NutritionProduct) {
        selectedProducts = if (isProductSelected(product)) {
            selectedProducts.filterNot { it.id == product.id }
        } else {
            selectedProducts + product
        }
    }

    LaunchedEffect(Unit) {
        nutritionRepo.recentProducts(mealType, page = 1, pageSize = 20)
            .onSuccess {
                recentForMeal = it.items
                recentForMealQuantities = it.lastQuantities
            }
        nutritionRepo.recentProducts(null, page = 1, pageSize = 20)
            .onSuccess { allRecent ->
                moreRecent = allRecent.items.filter { it !in recentForMeal }
            }
        isLoadingRecents = false
    }

    LaunchedEffect(query) {
        if (query.isBlank()) {
            searchResults = emptyList()
            isSearching = false
            return@LaunchedEffect
        }
        isSearching = true
        delay(300) // 300ms debounce
        nutritionRepo.searchProducts(query.trim(), page = 1)
            .onSuccess {
                searchResults = it.items
                isSearching = false
            }
            .onFailure {
                isSearching = false
            }
    }

    FormModalSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 24.dp)
        ) {
            // Header with search bar and action buttons. All controls (field + 3 buttons)
            // share the same 16dp radius and a borderless filled-surface look, so the row
            // reads as one consistent family instead of four differently-styled shapes.
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Search foods...", color = TextMuted) },
                    leadingIcon = {
                        Icon(Icons.Default.Search, contentDescription = null, tint = TextSecondary)
                    },
                    trailingIcon = {
                        if (query.isNotEmpty()) {
                            IconButton(onClick = { query = "" }) {
                                Icon(Icons.Default.Close, contentDescription = "Clear", tint = TextMuted)
                            }
                        }
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = colorScheme.surfaceContainerHigh,
                        unfocusedContainerColor = colorScheme.surfaceContainerHigh,
                        focusedBorderColor = colorScheme.primary,
                        unfocusedBorderColor = androidx.compose.ui.graphics.Color.Transparent,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    )
                )

                if (!selectionMode) {
                    HeaderIconButton(
                        onClick = onOpenBarcodeScanner,
                        icon = Icons.Default.QrCodeScanner,
                        contentDescription = "Barcode"
                    )
                }

                HeaderIconButton(
                    onClick = {
                        selectionMode = !selectionMode
                        if (!selectionMode) selectedProducts = emptyList()
                    },
                    icon = Icons.Default.Checklist,
                    contentDescription = "Select multiple",
                    active = selectionMode
                )

                HeaderIconButton(onClick = onDismiss, icon = Icons.Default.Close, contentDescription = "Close")
            }

            // Results / Recent Lists
            if (isSearching || isLoadingRecents) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp),
                    contentAlignment = Alignment.Center
                ) {
                    LoadingSpinner()
                }
            } else if (query.isNotBlank()) {
                if (searchResults.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 40.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(text = "No products found", color = TextMuted)
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 480.dp)
                            .padding(horizontal = 16.dp)
                    ) {
                        item {
                            ProductGroupHeader(icon = Icons.Default.Search, label = "SEARCH RESULTS", color = colorScheme.primary, showMacroHeader = true)
                        }
                        item {
                            ProductGroupCard {
                                searchResults.forEachIndexed { index, product ->
                                    val selected = isProductSelected(product)
                                    val prevSelected = index > 0 && isProductSelected(searchResults[index - 1])
                                    val nextSelected = index < searchResults.lastIndex && isProductSelected(searchResults[index + 1])
                                    ProductListItem(
                                        product = product,
                                        selectionMode = selectionMode,
                                        isSelected = selected,
                                        mergeTop = prevSelected,
                                        mergeBottom = nextSelected,
                                        showMacros = true,
                                        onClick = { if (selectionMode) toggleSelected(product) else onSelectProduct(product) }
                                    )
                                    if (index != searchResults.lastIndex && !(selected && nextSelected)) ProductDivider(colorScheme.outlineVariant)
                                }
                            }
                        }
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 480.dp)
                        .padding(horizontal = 16.dp)
                ) {
                    if (recentForMeal.isNotEmpty()) {
                        item {
                            ProductGroupHeader(icon = Icons.Default.History, label = "RECENTLY IN THIS MEAL", color = colorScheme.primary, showMacroHeader = false)
                        }
                        item {
                            ProductGroupCard {
                                recentForMeal.forEachIndexed { index, product ->
                                    val selected = isProductSelected(product)
                                    val prevSelected = index > 0 && isProductSelected(recentForMeal[index - 1])
                                    val nextSelected = index < recentForMeal.lastIndex && isProductSelected(recentForMeal[index + 1])
                                    ProductListItem(
                                        product = product,
                                        selectionMode = selectionMode,
                                        isSelected = selected,
                                        mergeTop = prevSelected,
                                        mergeBottom = nextSelected,
                                        lastQuantity = recentForMealQuantities[product.id],
                                        showMacros = false,
                                        onClick = { if (selectionMode) toggleSelected(product) else onSelectProduct(product) }
                                    )
                                    if (index != recentForMeal.lastIndex && !(selected && nextSelected)) ProductDivider(colorScheme.outlineVariant)
                                }
                            }
                        }
                        item { Spacer(modifier = Modifier.height(20.dp)) }
                    }

                    if (moreRecent.isNotEmpty()) {
                        item {
                            ProductGroupHeader(icon = Icons.Default.Storage, label = "FROM YOUR DATABASE", color = TextMuted, showMacroHeader = false)
                        }
                        item {
                            ProductGroupCard {
                                moreRecent.forEachIndexed { index, product ->
                                    val selected = isProductSelected(product)
                                    val prevSelected = index > 0 && isProductSelected(moreRecent[index - 1])
                                    val nextSelected = index < moreRecent.lastIndex && isProductSelected(moreRecent[index + 1])
                                    ProductListItem(
                                        product = product,
                                        selectionMode = selectionMode,
                                        isSelected = selected,
                                        mergeTop = prevSelected,
                                        mergeBottom = nextSelected,
                                        showMacros = false,
                                        onClick = { if (selectionMode) toggleSelected(product) else onSelectProduct(product) }
                                    )
                                    if (index != moreRecent.lastIndex && !(selected && nextSelected)) ProductDivider(colorScheme.outlineVariant)
                                }
                            }
                        }
                    }
                }
            }

            if (selectionMode && selectedProducts.isNotEmpty()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(colorScheme.primary)
                        .clickable {
                            onSelectMultiple(selectedProducts)
                            selectionMode = false
                            selectedProducts = emptyList()
                        }
                        .padding(vertical = 14.dp),
                    horizontalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = "Add ${selectedProducts.size} item${if (selectedProducts.size == 1) "" else "s"}",
                        color = colorScheme.onPrimary,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}

@Composable
private fun HeaderIconButton(
    onClick: () -> Unit,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    contentDescription: String,
    active: Boolean = false
) {
    val colorScheme = MaterialTheme.colorScheme
    IconButton(
        onClick = onClick,
        modifier = Modifier
            .size(46.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(if (active) colorScheme.primary else colorScheme.surfaceContainerHigh)
    ) {
        Icon(icon, contentDescription = contentDescription, tint = if (active) colorScheme.onPrimary else TextSecondary)
    }
}

@Composable
private fun ProductGroupHeader(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    color: androidx.compose.ui.graphics.Color,
    showMacroHeader: Boolean
) {
    Column(modifier = Modifier.padding(top = 10.dp, bottom = 4.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Icon(imageVector = icon, contentDescription = null, tint = color, modifier = Modifier.size(13.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 0.8.sp,
                color = color
            )
        }
        if (showMacroHeader) {
            Spacer(modifier = Modifier.height(4.dp))
            MacroIconHeader()
        }
    }
}

@Composable
private fun ProductGroupCard(content: @Composable () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(MaterialTheme.colorScheme.surfaceContainer)
    ) {
        content()
    }
}

@Composable
private fun ProductDivider(color: androidx.compose.ui.graphics.Color) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .height(0.8.dp)
            .background(color.copy(alpha = 0.5f))
    )
}

@Composable
fun ProductListItem(
    product: NutritionProduct,
    onClick: () -> Unit,
    selectionMode: Boolean = false,
    isSelected: Boolean = false,
    /** True when the previous/next row in the same list is also selected — flattens the
     * shared edge so a run of adjacent selected rows reads as one continuous shape instead
     * of a stack of individually-rounded cards. A selected row with no selected neighbor on
     * a given side keeps that corner rounded. */
    mergeTop: Boolean = false,
    mergeBottom: Boolean = false,
    /** The quantity actually logged last time (only known for "recently in this meal"). When
     * present it replaces the generic reference-amount subtitle with the real last portion. */
    lastQuantity: FoodQuantity? = null,
    showMacros: Boolean = true
) {
    val colorScheme = MaterialTheme.colorScheme
    val appLanguage = FormApp.instance.appPreferences.appLanguage
    val typeLabel = product.type?.resolve(appLanguage)

    val subtitle = when {
        lastQuantity != null -> listOfNotNull(product.brand, lastQuantity.displayText()).joinToString(" • ")
        showMacros -> listOfNotNull(
            product.brand,
            "${product.referenceBase?.amount?.toInt() ?: 100} ${product.baseUnit}"
        ).joinToString(" • ")
        else -> product.brand.orEmpty()
    }

    val highlightRadius = 14.dp
    val highlightShape = RoundedCornerShape(
        topStart = if (mergeTop) 0.dp else highlightRadius,
        topEnd = if (mergeTop) 0.dp else highlightRadius,
        bottomStart = if (mergeBottom) 0.dp else highlightRadius,
        bottomEnd = if (mergeBottom) 0.dp else highlightRadius
    )
    // Selected rows get a 6dp inset "card" instead of an edge-to-edge tint, so the highlight
    // never touches (and looks awkward against) the divider lines or the group card's own
    // rounded corners. Content padding shrinks by the same 6dp so the text never shifts
    // horizontally when a row becomes selected.
    val outerInset = if (isSelected) 6.dp else 0.dp
    val innerPadding = if (isSelected) 10.dp else 16.dp

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = outerInset)
            .then(
                if (isSelected) {
                    Modifier
                        .clip(highlightShape)
                        .background(colorScheme.primary.copy(alpha = 0.12f))
                } else {
                    Modifier
                }
            )
            .clickable(onClick = onClick)
            .padding(horizontal = innerPadding, vertical = 10.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    typeLabel?.let { ProductTypeChip(it) }
                    Text(text = product.name, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium, color = TextPrimary)
                }
                if (subtitle.isNotBlank()) {
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
            }
            // Fixed trailing slot: the leading chip+name+subtitle column never moves when
            // selection mode toggles, only the available width for it changes slightly.
            if (selectionMode) {
                Spacer(modifier = Modifier.width(10.dp))
                Icon(
                    imageVector = if (isSelected) Icons.Default.CheckCircle else Icons.Outlined.Circle,
                    contentDescription = if (isSelected) "Selected" else "Not selected",
                    tint = if (isSelected) colorScheme.primary else TextSecondary,
                    modifier = Modifier.size(22.dp)
                )
            }
        }

        if (showMacros) {
            Spacer(modifier = Modifier.height(6.dp))
            MacroColumns(
                summary = product.referenceSummary,
                fontSize = 13.sp,
                secondaryColor = TextSecondary,
                primaryColor = colorScheme.primary
            )
        }
    }
}

@Composable
private fun ProductTypeChip(label: String) {
    val colorScheme = MaterialTheme.colorScheme
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(7.dp))
            .background(colorScheme.tertiaryContainer)
            .padding(horizontal = 7.dp, vertical = 3.dp)
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = colorScheme.onTertiaryContainer
        )
    }
}
