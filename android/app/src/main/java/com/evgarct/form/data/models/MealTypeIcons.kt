package com.evgarct.form.data.models

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Egg
import androidx.compose.material.icons.filled.Fastfood
import androidx.compose.material.icons.filled.Nightlife
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.ui.graphics.vector.ImageVector

val MealType.icon: ImageVector
    get() = when (this) {
        MealType.BREAKFAST -> Icons.Default.Egg
        MealType.LUNCH -> Icons.Default.Restaurant
        MealType.DINNER -> Icons.Default.Nightlife
        MealType.SNACK -> Icons.Default.Fastfood
    }
