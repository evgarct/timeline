package com.evgarct.form.core.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Fixed brand hex, used only to build BrandDarkColorScheme/BrandLightColorScheme (the
// pre-API-31 fallback for devices without dynamic color). Everything else in the app should
// use the @Composable properties below instead, which proxy to the active
// MaterialTheme.colorScheme so every existing call site tracks light/dark mode and Material
// You dynamic color without being touched individually.
val PaperHex = Color(0xFFF2EEE6)
val InkHex = Color(0xFF15130F)
val LightInkHex = Color(0xFFFBF9F4)
val TraceHex = Color(0xFF806450)
val TraceDimHex = Color(0x33806450)

val SurfaceDarkHex = Color(0xFF1C1A16)
val SurfaceCardHex = Color(0xFF24211C)
val SurfaceCardBorderHex = Color(0xFF38342D)
val SurfaceCardHighlightHex = Color(0xFF2C2822)
val TextSecondaryDarkHex = Color(0xFF9E978E)
val TextMutedDarkHex = Color(0xFF68635B)
val RedAccentHex = Color(0xFFD9534F)

// Light-mode counterparts, used only by BrandLightColorScheme (pre-API-31 fallback).
val SurfaceLightHex = Color(0xFFFDFBF7)
val SurfaceLightVariantHex = Color(0xFFEDE7DB)
val SurfaceLightBorderHex = Color(0xFFDCD4C4)
val TextSecondaryLightHex = Color(0xFF6B655C)

// Small status accents with no direct Material3 role; kept as fixed literals since both have
// sufficient contrast on light and dark surfaces at their (small text/icon) usage sizes.
val GreenAccent = Color(0xFF4E9E68)
val OrangeAccent = Color(0xFFE5A93C)
val BlueAccent = Color(0xFF5B8DEF)

val Ink: Color @Composable get() = MaterialTheme.colorScheme.background
val LightInk: Color @Composable get() = MaterialTheme.colorScheme.onBackground
val TextPrimary: Color @Composable get() = MaterialTheme.colorScheme.onBackground
val TextSecondary: Color @Composable get() = MaterialTheme.colorScheme.onSurfaceVariant
val TextMuted: Color @Composable get() = MaterialTheme.colorScheme.outline
val SurfaceDark: Color @Composable get() = MaterialTheme.colorScheme.surface
val SurfaceCard: Color @Composable get() = MaterialTheme.colorScheme.surfaceContainer
val SurfaceCardBorder: Color @Composable get() = MaterialTheme.colorScheme.outlineVariant
val SurfaceCardHighlight: Color @Composable get() = MaterialTheme.colorScheme.surfaceContainerHigh
val Trace: Color @Composable get() = MaterialTheme.colorScheme.primary
val TraceDim: Color @Composable get() = MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)
val RedAccent: Color @Composable get() = MaterialTheme.colorScheme.error
val Paper: Color @Composable get() = MaterialTheme.colorScheme.surface
