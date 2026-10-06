package com.evgarct.form.core.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuDefaults
import androidx.compose.material3.MenuItemColors
import androidx.compose.runtime.Composable

/**
 * Explicit colors for dropdown menu items. With the dynamic dark scheme the items otherwise render
 * their text dark on the dark menu surface; use this for every `DropdownMenuItem`.
 */
@Composable
fun formMenuItemColors(): MenuItemColors = MenuDefaults.itemColors(
    textColor = MaterialTheme.colorScheme.onSurface,
    leadingIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
    trailingIconColor = MaterialTheme.colorScheme.onSurfaceVariant
)
