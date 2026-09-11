package com.evgarct.form.ui.shell

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.graphics.Color
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.evgarct.form.core.theme.Ink
import com.evgarct.form.core.theme.LightInk
import com.evgarct.form.core.theme.SurfaceCard
import com.evgarct.form.core.theme.TextMuted
import com.evgarct.form.core.theme.Trace
import com.evgarct.form.data.models.FoodEntry
import com.evgarct.form.data.models.MealType
import com.evgarct.form.data.models.NutrientValue
import com.evgarct.form.data.models.NutritionProduct
import com.evgarct.form.data.models.PhotoItem
import com.evgarct.form.ui.nutrition.BarcodeScannerSheet
import com.evgarct.form.ui.nutrition.FoodEntryEditorSheet
import com.evgarct.form.ui.nutrition.NutrientDetailsSheet
import com.evgarct.form.ui.nutrition.NutritionGoalsSheet
import com.evgarct.form.ui.nutrition.NutritionScreen
import com.evgarct.form.ui.nutrition.ProductSearchSheet
import com.evgarct.form.ui.nutrition.QuantityEditorSheet
import com.evgarct.form.ui.settings.SettingsSheet
import com.evgarct.form.ui.timeline.MeasurementEditorSheet
import com.evgarct.form.ui.timeline.TimelineScreen
import com.evgarct.form.ui.today.ActivityDetailSheet
import com.evgarct.form.ui.today.PhotoGallerySheet
import com.evgarct.form.ui.today.TodayScreen
import java.time.LocalDate
import java.util.Date

enum class AppTab { TODAY, NUTRITION, TIMELINE }

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

    // Activity detail sheet state
    var activeActivityDate by remember { mutableStateOf<LocalDate?>(null) }

    // Measurement editor state
    var showMeasurementEditor by remember { mutableStateOf(false) }

    // Nutrition sheets state
    data class AddProductState(val mealType: MealType, val date: Date)
    var activeAddProduct by remember { mutableStateOf<AddProductState?>(null) }
    var activeQuantityEditor by remember { mutableStateOf<Pair<NutritionProduct, AddProductState>?>(null) }
    var showBarcodeScanner by remember { mutableStateOf(false) }
    var activeEntryEditor by remember { mutableStateOf<FoodEntry?>(null) }
    var showGoalsEditor by remember { mutableStateOf(false) }
    var activeNutrientsList by remember { mutableStateOf<List<NutrientValue>?>(null) }

    Scaffold(
        containerColor = Color.Black,
        bottomBar = {
            NavigationBar(
                containerColor = Color.Black,
                tonalElevation = 0.dp
            ) {
                NavigationBarItem(
                    selected = selectedTab == AppTab.TODAY,
                    onClick = { selectedTab = AppTab.TODAY },
                    icon = { Icon(Icons.Default.Home, contentDescription = "Today") },
                    label = { Text("Today") },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Color.White,
                        selectedTextColor = Color.White,
                        unselectedIconColor = Color.White.copy(alpha = 0.45f),
                        unselectedTextColor = Color.White.copy(alpha = 0.45f),
                        indicatorColor = Color.Transparent
                    )
                )
                NavigationBarItem(
                    selected = selectedTab == AppTab.NUTRITION,
                    onClick = { selectedTab = AppTab.NUTRITION },
                    icon = { Icon(Icons.Default.Restaurant, contentDescription = "Nutrition") },
                    label = { Text("Nutrition") },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Color.White,
                        selectedTextColor = Color.White,
                        unselectedIconColor = Color.White.copy(alpha = 0.45f),
                        unselectedTextColor = Color.White.copy(alpha = 0.45f),
                        indicatorColor = Color.Transparent
                    )
                )
                NavigationBarItem(
                    selected = selectedTab == AppTab.TIMELINE,
                    onClick = { selectedTab = AppTab.TIMELINE },
                    icon = { Icon(Icons.Default.BarChart, contentDescription = "Timeline") },
                    label = { Text("Timeline") },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Color.White,
                        selectedTextColor = Color.White,
                        unselectedIconColor = Color.White.copy(alpha = 0.45f),
                        unselectedTextColor = Color.White.copy(alpha = 0.45f),
                        indicatorColor = Color.Transparent
                    )
                )
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = innerPadding.calculateBottomPadding())
                .background(Ink)
        ) {
            when (selectedTab) {
                AppTab.TODAY -> {
                    TodayScreen(
                        onOpenSettings = { showSettings = true },
                        onOpenPhotoGallery = { id, photos, idx ->
                            activeGallery = GalleryState(id, photos, idx)
                        },
                        onOpenActivityDetail = { activeActivityDate = it }
                    )
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

            activeActivityDate?.let { date ->
                ActivityDetailSheet(
                    initialDate = date,
                    onDismiss = { activeActivityDate = null }
                )
            }

            if (showMeasurementEditor) {
                MeasurementEditorSheet(
                    onDismiss = { showMeasurementEditor = false },
                    onSaved = { showMeasurementEditor = false }
                )
            }

            activeAddProduct?.let { addState ->
                ProductSearchSheet(
                    mealType = addState.mealType,
                    onDismiss = { activeAddProduct = null },
                    onSelectProduct = { prod ->
                        activeQuantityEditor = prod to addState
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

            if (showBarcodeScanner) {
                BarcodeScannerSheet(
                    onDismiss = { showBarcodeScanner = false },
                    onBarcodeScanned = { barcode ->
                        showBarcodeScanner = false
                        // look up product by barcode
                    }
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
