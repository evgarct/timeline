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
    var moreRecent by remember { mutableStateOf<List<NutritionProduct>>(emptyList()) }
    var isSearching by remember { mutableStateOf(false) }
    var isLoadingRecents by remember { mutableStateOf(true) }

    var selectionMode by remember { mutableStateOf(false) }
    var selectedProducts by remember { mutableStateOf<List<NutritionProduct>>(emptyList()) }

    fun toggleSelected(product: NutritionProduct) {
        selectedProducts = if (selectedProducts.any { it.id == product.id }) {
            selectedProducts.filterNot { it.id == product.id }
        } else {
            selectedProducts + product
        }
    }

    LaunchedEffect(Unit) {
        nutritionRepo.recentProducts(mealType, page = 1, pageSize = 20)
            .onSuccess { recentForMeal = it.items }
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
            // Header with search bar and barcode button
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Search foods...", color = TextMuted) },
                    leadingIcon = {
                        Icon(Icons.Default.Search, contentDescription = null, tint = TextMuted)
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
                        unfocusedBorderColor = colorScheme.outlineVariant,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    )
                )

                Spacer(modifier = Modifier.width(8.dp))

                if (!selectionMode) {
                    IconButton(
                        onClick = onOpenBarcodeScanner,
                        modifier = Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(colorScheme.tertiaryContainer)
                    ) {
                        Icon(Icons.Default.QrCodeScanner, contentDescription = "Barcode", tint = colorScheme.onTertiaryContainer)
                    }

                    Spacer(modifier = Modifier.width(4.dp))
                }

                IconButton(
                    onClick = {
                        selectionMode = !selectionMode
                        if (!selectionMode) selectedProducts = emptyList()
                    },
                    modifier = Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(if (selectionMode) colorScheme.primary else colorScheme.surfaceContainerHigh)
                ) {
                    Icon(
                        Icons.Default.Checklist,
                        contentDescription = "Select multiple",
                        tint = if (selectionMode) colorScheme.onPrimary else TextMuted
                    )
                }

                Spacer(modifier = Modifier.width(4.dp))

                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = "Close", tint = TextPrimary)
                }
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
                            ProductGroupHeader(icon = Icons.Default.Search, label = "SEARCH RESULTS", color = colorScheme.primary)
                        }
                        item {
                            ProductGroupCard {
                                searchResults.forEachIndexed { index, product ->
                                    ProductListItem(
                                        product = product,
                                        selectionMode = selectionMode,
                                        isSelected = selectedProducts.any { it.id == product.id },
                                        onClick = { if (selectionMode) toggleSelected(product) else onSelectProduct(product) }
                                    )
                                    if (index != searchResults.lastIndex) ProductDivider(colorScheme.outlineVariant)
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
                            ProductGroupHeader(icon = Icons.Default.History, label = "RECENTLY IN THIS MEAL", color = colorScheme.primary)
                        }
                        item {
                            ProductGroupCard {
                                recentForMeal.forEachIndexed { index, product ->
                                    ProductListItem(
                                        product = product,
                                        selectionMode = selectionMode,
                                        isSelected = selectedProducts.any { it.id == product.id },
                                        onClick = { if (selectionMode) toggleSelected(product) else onSelectProduct(product) }
                                    )
                                    if (index != recentForMeal.lastIndex) ProductDivider(colorScheme.outlineVariant)
                                }
                            }
                        }
                        item { Spacer(modifier = Modifier.height(20.dp)) }
                    }

                    if (moreRecent.isNotEmpty()) {
                        item {
                            ProductGroupHeader(icon = Icons.Default.Storage, label = "FROM YOUR DATABASE", color = TextMuted)
                        }
                        item {
                            ProductGroupCard {
                                moreRecent.forEachIndexed { index, product ->
                                    ProductListItem(
                                        product = product,
                                        selectionMode = selectionMode,
                                        isSelected = selectedProducts.any { it.id == product.id },
                                        onClick = { if (selectionMode) toggleSelected(product) else onSelectProduct(product) }
                                    )
                                    if (index != moreRecent.lastIndex) ProductDivider(colorScheme.outlineVariant)
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
private fun ProductGroupHeader(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, color: androidx.compose.ui.graphics.Color) {
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
        Spacer(modifier = Modifier.height(4.dp))
        MacroIconHeader()
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
    isSelected: Boolean = false
) {
    val summary = product.referenceSummary
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 9.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (selectionMode) {
                Icon(
                    imageVector = if (isSelected) Icons.Default.CheckCircle else Icons.Outlined.Circle,
                    contentDescription = if (isSelected) "Selected" else "Not selected",
                    tint = if (isSelected) MaterialTheme.colorScheme.primary else TextMuted,
                    modifier = Modifier.size(20.dp)
                )
            }
            Column {
                Text(text = product.name, style = MaterialTheme.typography.bodyMedium, color = TextPrimary)
                val subtitle = buildString {
                    product.brand?.let { append(it).append(" • ") }
                    append("${product.referenceBase?.amount?.toInt() ?: 100} ${product.baseUnit}")
                }
                Text(text = subtitle, style = MaterialTheme.typography.bodySmall, color = TextMuted)
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        MacroColumns(
            summary = summary,
            fontSize = 13.sp,
            secondaryColor = TextSecondary,
            primaryColor = MaterialTheme.colorScheme.primary
        )
    }
}
