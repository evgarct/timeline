package com.evgarct.form.core.theme

import android.app.Activity
import android.content.Context
import android.os.Build
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.MaterialExpressiveTheme
import androidx.compose.material3.MotionScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

/**
 * Fixed brand palette — used as the pre-Android-12 fallback (no dynamic color API)
 * and by the PDF/OG report renderer, which must render with Form's brand colors
 * regardless of the generating device's wallpaper.
 */
val BrandDarkColorScheme = darkColorScheme(
    primary = Trace,
    onPrimary = LightInk,
    primaryContainer = TraceDim,
    onPrimaryContainer = LightInk,
    secondary = TextSecondary,
    onSecondary = Ink,
    background = Ink,
    onBackground = LightInk,
    surface = SurfaceDark,
    onSurface = LightInk,
    surfaceVariant = SurfaceCard,
    onSurfaceVariant = TextSecondary,
    outline = SurfaceCardBorder,
    error = RedAccent,
    onError = LightInk
)

private fun dynamicOrBrandColorScheme(context: Context): ColorScheme {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        dynamicDarkColorScheme(context)
    } else {
        BrandDarkColorScheme
    }
}

@OptIn(ExperimentalMaterial3ExpressiveApi::class)
@Composable
fun FormTheme(
    content: @Composable () -> Unit
) {
    val context = LocalContext.current
    val colorScheme = dynamicOrBrandColorScheme(context)
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            val backgroundArgb = colorScheme.background.toArgb()
            window.statusBarColor = backgroundArgb
            window.navigationBarColor = backgroundArgb
            val isLightBackground = colorScheme.background.luminance() > 0.5f
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = isLightBackground
            WindowCompat.getInsetsController(window, view).isAppearanceLightNavigationBars = isLightBackground
        }
    }

    MaterialExpressiveTheme(
        colorScheme = colorScheme,
        typography = Typography,
        motionScheme = MotionScheme.expressive(),
        content = content
    )
}
