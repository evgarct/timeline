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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Search
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
import com.evgarct.form.core.theme.Ink
import com.evgarct.form.core.theme.LightInk
import com.evgarct.form.core.theme.SurfaceCard
import com.evgarct.form.core.theme.SurfaceCardBorder
import com.evgarct.form.core.theme.TextMuted
import com.evgarct.form.core.theme.TextSecondary
import com.evgarct.form.core.theme.Trace
import com.evgarct.form.data.models.MealType
import com.evgarct.form.data.models.NutritionProduct
import com.evgarct.form.ui.components.LoadingSpinner
import kotlinx.coroutines.delay

@Composable
fun ProductSearchSheet(
    mealType: MealType,
    onDismiss: () -> Unit,
    onSelectProduct: (NutritionProduct) -> Unit,
    onOpenBarcodeScanner: () -> Unit
) {
    val nutritionRepo = FormApp.instance.nutritionRepository

    var query by remember { mutableStateOf("") }
    var searchResults by remember { mutableStateOf<List<NutritionProduct>>(emptyList()) }
    var recentForMeal by remember { mutableStateOf<List<NutritionProduct>>(emptyList()) }
    var moreRecent by remember { mutableStateOf<List<NutritionProduct>>(emptyList()) }
    var isSearching by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        nutritionRepo.recentProducts(mealType, page = 1, pageSize = 20)
            .onSuccess { recentForMeal = it.items }
        nutritionRepo.recentProducts(null, page = 1, pageSize = 20)
            .onSuccess { allRecent ->
                moreRecent = allRecent.items.filter { it !in recentForMeal }
            }
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
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = SurfaceCard,
                        unfocusedContainerColor = SurfaceCard,
                        focusedBorderColor = Trace,
                        unfocusedBorderColor = SurfaceCardBorder,
                        focusedTextColor = LightInk,
                        unfocusedTextColor = LightInk
                    )
                )

                Spacer(modifier = Modifier.width(8.dp))

                IconButton(
                    onClick = onOpenBarcodeScanner,
                    modifier = Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(SurfaceCard)
                ) {
                    Icon(Icons.Default.QrCodeScanner, contentDescription = "Barcode", tint = Trace)
                }

                Spacer(modifier = Modifier.width(4.dp))

                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = "Close", tint = LightInk)
                }
            }

            // Results / Recent Lists
            if (isSearching) {
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
                    LazyColumn(modifier = Modifier.fillMaxSize()) {
                        items(searchResults) { product ->
                            ProductListItem(product = product, onClick = { onSelectProduct(product) })
                        }
                    }
                }
            } else {
                LazyColumn(modifier = Modifier.fillMaxSize()) {
                    if (recentForMeal.isNotEmpty()) {
                        item {
                            Text(
                                text = "RECENTLY IN THIS MEAL",
                                style = MaterialTheme.typography.labelSmall,
                                color = Trace,
                                modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp)
                            )
                        }
                        items(recentForMeal) { product ->
                            ProductListItem(product = product, onClick = { onSelectProduct(product) })
                        }
                    }

                    if (moreRecent.isNotEmpty()) {
                        item {
                            Text(
                                text = "MORE PRODUCTS",
                                style = MaterialTheme.typography.labelSmall,
                                color = Trace,
                                modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp)
                            )
                        }
                        items(moreRecent) { product ->
                            ProductListItem(product = product, onClick = { onSelectProduct(product) })
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ProductListItem(product: NutritionProduct, onClick: () -> Unit) {
    val summary = product.referenceSummary
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(text = product.name, style = MaterialTheme.typography.bodyLarge, color = LightInk)
            val subtitle = buildString {
                product.brand?.let { append(it).append(" • ") }
                append("${product.referenceBase?.amount?.toInt() ?: 100} ${product.baseUnit}")
            }
            Text(text = subtitle, style = MaterialTheme.typography.bodySmall, color = TextMuted)
        }

        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = "${summary.calories.toInt()} kcal",
                style = MaterialTheme.typography.bodyMedium,
                color = Trace,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = "${summary.protein.toInt()}p / ${summary.fat.toInt()}f / ${summary.carbohydrates.toInt()}c",
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondary
            )
        }
    }
}
