package com.evgarct.form.ui.shell

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.DirectionsWalk
import androidx.compose.material.icons.automirrored.rounded.ShowChart
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.IosShare
import androidx.compose.material.icons.rounded.Restaurant
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.evgarct.form.FormApp
import com.evgarct.form.data.models.FoodEntry
import com.evgarct.form.data.models.MealType
import com.evgarct.form.data.models.NutrientValue
import com.evgarct.form.data.models.NutritionProduct
import com.evgarct.form.data.models.PhotoItem
import com.evgarct.form.ui.activity.ActivityScreen
import com.evgarct.form.ui.export.ExportScreen
import com.evgarct.form.ui.nutrition.BarcodeScannerSheet
import com.evgarct.form.ui.nutrition.BatchQuantityEditorSheet
import com.evgarct.form.ui.nutrition.FoodEntryEditorSheet
import com.evgarct.form.ui.nutrition.NutrientDetailsSheet
import com.evgarct.form.ui.nutrition.NutritionGoalsSheet
import com.evgarct.form.ui.nutrition.NutritionScreen
import com.evgarct.form.ui.nutrition.ProductSearchSheet
import com.evgarct.form.ui.nutrition.QuantityEditorSheet
import com.evgarct.form.ui.settings.SettingsSheet
import com.evgarct.form.ui.timeline.MeasurementEditorSheet
import com.evgarct.form.ui.timeline.TimelineScreen
import com.evgarct.form.ui.today.PhotoGallerySheet
import com.evgarct.form.ui.today.TodayScreen
import kotlinx.coroutines.launch
import java.util.Date

enum class AppTab { TODAY, ACTIVITY, NUTRITION, TIMELINE, EXPORT }

@Composable
fun RootScreen(
    onSignOut: () -> Unit
) {
    var selectedTab by remember { mutableStateOf(AppTab.TODAY) }

    // Navigation Sheets
    var showSettings by remember { mutableStateOf(false) }

    // Gallery sheet state
    data class GalleryState(val eventId: String, val photos: List<PhotoItem>, val initialIndex: Int)
    var activeGallery by remember { mutableStateOf<GalleryState?>(null) }

    // Measurement editor state
    var showMeasurementEditor by remember { mutableStateOf(false) }

    // Nutrition sheets state
    data class AddProductState(val mealType: MealType, val date: Date)
    var activeAddProduct by remember { mutableStateOf<AddProductState?>(null) }
    var activeQuantityEditor by remember { mutableStateOf<Pair<NutritionProduct, AddProductState>?>(null) }
    var activeBatchQuantityEditor by remember { mutableStateOf<Pair<List<NutritionProduct>, AddProductState>?>(null) }
    var showBarcodeScanner by remember { mutableStateOf(false) }
    var barcodeNotFound by remember { mutableStateOf(false) }
    var activeEntryEditor by remember { mutableStateOf<FoodEntry?>(null) }
    var showGoalsEditor by remember { mutableStateOf(false) }
    var activeNutrientsList by remember { mutableStateOf<List<NutrientValue>?>(null) }

    val nutritionRepo = FormApp.instance.nutritionRepository
    val barcodeLookupScope = rememberCoroutineScope()

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.background,
                tonalElevation = 0.dp
            ) {
                NavigationBarItem(
                    selected = selectedTab == AppTab.TODAY,
                    onClick = { selectedTab = AppTab.TODAY },
                    icon = { Icon(Icons.Rounded.Home, contentDescription = "Today") },
                    label = { Text("Today") }
                )
                NavigationBarItem(
                    selected = selectedTab == AppTab.ACTIVITY,
                    onClick = { selectedTab = AppTab.ACTIVITY },
                    icon = { Icon(Icons.AutoMirrored.Rounded.DirectionsWalk, contentDescription = "Activity") },
                    label = { Text("Activity") }
                )
                NavigationBarItem(
                    selected = selectedTab == AppTab.NUTRITION,
                    onClick = { selectedTab = AppTab.NUTRITION },
                    icon = { Icon(Icons.Rounded.Restaurant, contentDescription = "Nutrition") },
                    label = { Text("Nutrition") }
                )
                NavigationBarItem(
                    selected = selectedTab == AppTab.TIMELINE,
                    onClick = { selectedTab = AppTab.TIMELINE },
                    icon = { Icon(Icons.AutoMirrored.Rounded.ShowChart, contentDescription = "Timeline") },
                    label = { Text("Timeline") }
                )
                NavigationBarItem(
                    selected = selectedTab == AppTab.EXPORT,
                    onClick = { selectedTab = AppTab.EXPORT },
                    icon = { Icon(Icons.Rounded.IosShare, contentDescription = "Export") },
                    label = { Text("Export") }
                )
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = innerPadding.calculateBottomPadding())
                .background(MaterialTheme.colorScheme.background)
        ) {
            when (selectedTab) {
                AppTab.TODAY -> {
                    TodayScreen(
                        onOpenSettings = { showSettings = true },
                        onOpenPhotoGallery = { id, photos, idx ->
                            activeGallery = GalleryState(id, photos, idx)
                        },
                        onOpenActivityDetail = { selectedTab = AppTab.ACTIVITY },
                        onOpenNutrition = { selectedTab = AppTab.NUTRITION }
                    )
                }
                AppTab.ACTIVITY -> {
                    ActivityScreen()
                }
                AppTab.NUTRITION -> {
                    NutritionScreen(
                        onOpenNutrientsSheet = { activeNutrientsList = it },
                        onOpenGoalsEditor = { showGoalsEditor = true },
                        onOpenAddProduct = { meal, d -> activeAddProduct = AddProductState(meal, d) },
                        onOpenEntryEditor = { activeEntryEditor = it }
                    )
                }
                AppTab.TIMELINE -> {
                    TimelineScreen(
                        onOpenPhotoGallery = { id, photos, idx ->
                            activeGallery = GalleryState(id, photos, idx)
                        },
                        onOpenMeasurementEditor = { showMeasurementEditor = true }
                    )
                }
                AppTab.EXPORT -> {
                    ExportScreen()
                }
            }

            // Sheets Overlays
            if (showSettings) {
                SettingsSheet(
                    onDismiss = { showSettings = false },
                    onSignedOut = {
                        showSettings = false
                        onSignOut()
                    }
                )
            }

            activeGallery?.let { gallery ->
                PhotoGallerySheet(
                    eventId = gallery.eventId,
                    photos = gallery.photos,
                    initialIndex = gallery.initialIndex,
                    canPinCover = selectedTab == AppTab.TODAY,
                    onDismiss = { activeGallery = null }
                )
            }

            if (showMeasurementEditor) {
                MeasurementEditorSheet(
                    onDismiss = { showMeasurementEditor = false },
                    onSaved = { showMeasurementEditor = false }
                )
            }

            if (activeAddProduct != null && !showBarcodeScanner && activeBatchQuantityEditor == null) {
                val addState = activeAddProduct!!
                ProductSearchSheet(
                    mealType = addState.mealType,
                    onDismiss = { activeAddProduct = null },
                    onSelectProduct = { prod ->
                        activeQuantityEditor = prod to addState
                    },
                    onSelectMultiple = { products ->
                        activeBatchQuantityEditor = products to addState
                    },
                    onOpenBarcodeScanner = { showBarcodeScanner = true }
                )
            }

            activeQuantityEditor?.let { (product, addState) ->
                QuantityEditorSheet(
                    product = product,
                    mealType = addState.mealType,
                    date = addState.date,
                    onDismiss = { activeQuantityEditor = null },
                    onSaved = {
                        activeQuantityEditor = null
                        activeAddProduct = null
                    },
                    onOpenNutrients = { activeNutrientsList = it }
                )
            }

            activeBatchQuantityEditor?.let { (products, addState) ->
                BatchQuantityEditorSheet(
                    products = products,
                    mealType = addState.mealType,
                    date = addState.date,
                    onDismiss = { activeBatchQuantityEditor = null },
                    onSaved = {
                        activeBatchQuantityEditor = null
                        activeAddProduct = null
                    }
                )
            }

            if (showBarcodeScanner) {
                BarcodeScannerSheet(
                    onDismiss = { showBarcodeScanner = false },
                    onBarcodeScanned = { barcode ->
                        showBarcodeScanner = false
                        val addState = activeAddProduct
                        if (addState != null) {
                            barcodeLookupScope.launch {
                                nutritionRepo.findProductByBarcode(barcode)
                                    .onSuccess { product ->
                                        if (product != null) {
                                            activeQuantityEditor = product to addState
                                            activeAddProduct = null
                                        } else {
                                            barcodeNotFound = true
                                        }
                                    }
                                    .onFailure { barcodeNotFound = true }
                            }
                        }
                    }
                )
            }

            if (barcodeNotFound) {
                AlertDialog(
                    onDismissRequest = { barcodeNotFound = false },
                    confirmButton = {
                        TextButton(onClick = { barcodeNotFound = false }) { Text("OK") }
                    },
                    title = { Text("Product not found") },
                    text = { Text("No product with this barcode is in your database yet.") }
                )
            }

            activeEntryEditor?.let { entry ->
                FoodEntryEditorSheet(
                    entry = entry,
                    onDismiss = { activeEntryEditor = null },
                    onUpdated = { activeEntryEditor = null },
                    onDeleted = { activeEntryEditor = null },
                    onOpenNutrients = { activeNutrientsList = it }
                )
            }

            if (showGoalsEditor) {
                NutritionGoalsSheet(
                    onDismiss = { showGoalsEditor = false },
                    onSaved = { showGoalsEditor = false }
                )
            }

            activeNutrientsList?.let { nutrients ->
                NutrientDetailsSheet(
                    nutrients = nutrients,
                    onDismiss = { activeNutrientsList = null }
                )
            }
        }
    }
}
