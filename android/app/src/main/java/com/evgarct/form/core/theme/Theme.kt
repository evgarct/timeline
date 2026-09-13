package com.evgarct.form.core.theme

import android.app.Activity
import android.content.Context
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.MaterialExpressiveTheme
import androidx.compose.material3.MotionScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import com.evgarct.form.FormApp

/** Persisted appearance choice; SYSTEM (default) follows the device's own dark-mode setting. */
enum class ThemeMode(val key: String) {
    SYSTEM("system"),
    LIGHT("light"),
    DARK("dark");

    companion object {
        fun fromKey(key: String?): ThemeMode = entries.firstOrNull { it.key == key } ?: SYSTEM
    }
}

/**
 * Fixed brand palettes — used as the pre-Android-12 fallback (no dynamic color API) and by the
 * PDF/OG report renderer, which must render with Form's brand colors regardless of the
 * generating device's wallpaper.
 */
val BrandDarkColorScheme = darkColorScheme(
    primary = TraceHex,
    onPrimary = LightInkHex,
    primaryContainer = TraceDimHex,
    onPrimaryContainer = LightInkHex,
    secondary = TextSecondaryDarkHex,
    onSecondary = InkHex,
    background = InkHex,
    onBackground = LightInkHex,
    surface = SurfaceDarkHex,
    onSurface = LightInkHex,
    surfaceVariant = SurfaceCardHex,
    onSurfaceVariant = TextSecondaryDarkHex,
    outline = SurfaceCardBorderHex,
    error = RedAccentHex,
    onError = LightInkHex
)

val BrandLightColorScheme = lightColorScheme(
    primary = TraceHex,
    onPrimary = LightInkHex,
    primaryContainer = TraceHex.copy(alpha = 0.18f),
    onPrimaryContainer = InkHex,
    secondary = TextSecondaryLightHex,
    onSecondary = PaperHex,
    background = PaperHex,
    onBackground = InkHex,
    surface = SurfaceLightHex,
    onSurface = InkHex,
    surfaceVariant = SurfaceLightVariantHex,
    onSurfaceVariant = TextSecondaryLightHex,
    outline = SurfaceLightBorderHex,
    error = RedAccentHex,
    onError = PaperHex
)

private fun resolveColorScheme(context: Context, isDark: Boolean): ColorScheme {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        if (isDark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
    } else {
        if (isDark) BrandDarkColorScheme else BrandLightColorScheme
    }
}

@OptIn(ExperimentalMaterial3ExpressiveApi::class)
@Composable
fun FormTheme(
    content: @Composable () -> Unit
) {
    val context = LocalContext.current
    val prefs = FormApp.instance.appPreferences
    val systemDark = isSystemInDarkTheme()
    val isDark = when (prefs.themeMode) {
        ThemeMode.SYSTEM -> systemDark
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }
    val colorScheme = resolveColorScheme(context, isDark)
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            val backgroundArgb = colorScheme.background.toArgb()
            window.statusBarColor = backgroundArgb
            window.navigationBarColor = backgroundArgb
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !isDark
            WindowCompat.getInsetsController(window, view).isAppearanceLightNavigationBars = !isDark
        }
    }

    MaterialExpressiveTheme(
        colorScheme = colorScheme,
        typography = formTypography(),
        motionScheme = MotionScheme.expressive(),
        content = content
    )
}
