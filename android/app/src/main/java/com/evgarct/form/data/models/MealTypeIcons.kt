package com.evgarct.form.data.models

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BreakfastDining
import androidx.compose.material.icons.filled.Cookie
import androidx.compose.material.icons.filled.DinnerDining
import androidx.compose.material.icons.filled.LunchDining
import androidx.compose.ui.graphics.vector.ImageVector

val MealType.icon: ImageVector
    get() = when (this) {
        MealType.BREAKFAST -> Icons.Default.BreakfastDining
        MealType.LUNCH -> Icons.Default.LunchDining
        MealType.DINNER -> Icons.Default.DinnerDining
        MealType.SNACK -> Icons.Default.Cookie
    }
