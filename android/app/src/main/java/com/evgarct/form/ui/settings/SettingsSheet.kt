package com.evgarct.form.ui.settings

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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evgarct.form.FormApp
import com.evgarct.form.R
import com.evgarct.form.core.theme.Ink
import com.evgarct.form.core.theme.RedAccent
import com.evgarct.form.core.theme.SurfaceCard
import com.evgarct.form.core.theme.SurfaceCardBorder
import com.evgarct.form.core.theme.TextMuted
import com.evgarct.form.core.theme.TextPrimary
import com.evgarct.form.core.theme.ThemeMode
import kotlinx.coroutines.launch

@Composable
fun SettingsSheet(
    onDismiss: () -> Unit,
    onSignedOut: () -> Unit
) {
    val prefs = FormApp.instance.appPreferences
    val authRepo = FormApp.instance.authRepository
    val scope = rememberCoroutineScope()

    var appLanguage by remember { mutableStateOf(prefs.appLanguage) }
    var reportLanguage by remember { mutableStateOf(prefs.reportLanguage) }
    var themeMode by remember { mutableStateOf(prefs.themeMode) }

    val languages = listOf("en" to "English", "ru" to "Русский", "cs" to "Čeština")
    val themeModes = listOf(
        ThemeMode.SYSTEM to stringResource(R.string.settings_appearance_system),
        ThemeMode.LIGHT to stringResource(R.string.settings_appearance_light),
        ThemeMode.DARK to stringResource(R.string.settings_appearance_dark)
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Ink)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .padding(top = 10.dp, start = 22.dp, end = 22.dp)
                .verticalScroll(rememberScrollState())
        ) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Settings",
                    fontSize = 32.sp,
                    fontFamily = FontFamily.Serif,
                    letterSpacing = (-0.8).sp,
                    color = TextPrimary
                )

                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(SurfaceCard)
                        .clickable { onDismiss() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Close",
                        tint = TextPrimary,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Appearance Section
            SettingsSectionHeader(text = stringResource(R.string.settings_appearance))
            Spacer(modifier = Modifier.height(8.dp))
            SettingsOptionGroup(
                options = themeModes,
                isSelected = { it.first == themeMode },
                label = { it.second },
                onSelect = { (mode, _) ->
                    themeMode = mode
                    prefs.updateThemeMode(mode)
                }
            )

            Spacer(modifier = Modifier.height(28.dp))

            // App Language Section
            SettingsSectionHeader(text = "APP LANGUAGE")
            Spacer(modifier = Modifier.height(8.dp))
            SettingsOptionGroup(
                options = languages,
                isSelected = { it.first == appLanguage },
                label = { it.second },
                onSelect = { (code, _) ->
                    appLanguage = code
                    prefs.appLanguage = code
                }
            )

            Spacer(modifier = Modifier.height(28.dp))

            // Report Language Section
            SettingsSectionHeader(text = "REPORT LANGUAGE")
            Spacer(modifier = Modifier.height(8.dp))
            SettingsOptionGroup(
                options = languages,
                isSelected = { it.first == reportLanguage },
                label = { it.second },
                onSelect = { (code, _) ->
                    reportLanguage = code
                    prefs.reportLanguage = code
                }
            )

            Spacer(modifier = Modifier.height(28.dp))

            // About Section
            SettingsSectionHeader(text = "ABOUT")
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(SurfaceCard)
                    .padding(horizontal = 18.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(text = "Form", fontSize = 16.sp, color = TextPrimary)
                Text(text = "0.1.0", fontSize = 15.sp, color = TextMuted)
            }

            Spacer(modifier = Modifier.height(36.dp))

            // Sign out Button
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .background(RedAccent.copy(alpha = 0.15f))
                    .clickable {
                        scope.launch {
                            authRepo.signOut()
                            onSignedOut()
                        }
                    },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Sign Out",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium,
                    color = RedAccent
                )
            }

            Spacer(modifier = Modifier.height(36.dp))
        }
    }
}

@Composable
private fun SettingsSectionHeader(text: String) {
    Text(
        text = text,
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 1.2.sp,
        color = TextMuted
    )
}

/** The checkmark-list picker pattern shared by the Appearance and language sections. */
@Composable
private fun <T> SettingsOptionGroup(
    options: List<T>,
    isSelected: (T) -> Boolean,
    label: (T) -> String,
    onSelect: (T) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(SurfaceCard)
    ) {
        options.forEachIndexed { index, option ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onSelect(option) }
                    .padding(horizontal = 18.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = label(option),
                    fontSize = 16.sp,
                    color = TextPrimary
                )
                if (isSelected(option)) {
                    Icon(
                        imageVector = Icons.Default.Check,
                        contentDescription = null,
                        tint = TextPrimary,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
            if (index < options.size - 1) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 18.dp)
                        .height(1.dp)
                        .background(SurfaceCardBorder)
                )
            }
        }
    }
}
