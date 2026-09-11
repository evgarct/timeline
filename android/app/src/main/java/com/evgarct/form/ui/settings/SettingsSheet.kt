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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evgarct.form.FormApp
import com.evgarct.form.core.theme.Ink
import com.evgarct.form.core.theme.LightInk
import com.evgarct.form.core.theme.RedAccent
import com.evgarct.form.core.theme.SurfaceCard
import com.evgarct.form.core.theme.SurfaceCardBorder
import com.evgarct.form.core.theme.TextMuted
import com.evgarct.form.core.theme.TextSecondary
import com.evgarct.form.core.theme.Trace
import com.evgarct.form.ui.components.GlassCard
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

    val languages = listOf("en" to "English", "ru" to "Русский", "cs" to "Čeština")

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Ink)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(top = 40.dp, start = 20.dp, end = 20.dp)
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
                    style = MaterialTheme.typography.titleMedium,
                    color = LightInk
                )

                IconButton(onClick = onDismiss) {
                    Icon(imageVector = Icons.Default.Close, contentDescription = "Close", tint = LightInk)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // App Language Section
            Text(text = "APP LANGUAGE", style = MaterialTheme.typography.labelSmall, color = Trace)
            Spacer(modifier = Modifier.height(8.dp))
            GlassCard(modifier = Modifier.fillMaxWidth()) {
                Column {
                    languages.forEachIndexed { index, (code, name) ->
                        val isSelected = appLanguage == code
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    appLanguage = code
                                    prefs.appLanguage = code
                                }
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(text = name, style = MaterialTheme.typography.bodyLarge, color = LightInk)
                            if (isSelected) {
                                Icon(Icons.Default.Check, contentDescription = null, tint = Trace, modifier = Modifier.size(18.dp))
                            }
                        }
                        if (index < languages.size - 1) {
                            Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(SurfaceCardBorder))
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Report Language Section
            Text(text = "REPORT LANGUAGE", style = MaterialTheme.typography.labelSmall, color = Trace)
            Spacer(modifier = Modifier.height(8.dp))
            GlassCard(modifier = Modifier.fillMaxWidth()) {
                Column {
                    languages.forEachIndexed { index, (code, name) ->
                        val isSelected = reportLanguage == code
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    reportLanguage = code
                                    prefs.reportLanguage = code
                                }
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(text = name, style = MaterialTheme.typography.bodyLarge, color = LightInk)
                            if (isSelected) {
                                Icon(Icons.Default.Check, contentDescription = null, tint = Trace, modifier = Modifier.size(18.dp))
                            }
                        }
                        if (index < languages.size - 1) {
                            Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(SurfaceCardBorder))
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // About Section
            Text(text = "ABOUT", style = MaterialTheme.typography.labelSmall, color = Trace)
            Spacer(modifier = Modifier.height(8.dp))
            GlassCard(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = "Form for Android", style = MaterialTheme.typography.bodyLarge, color = LightInk)
                    Text(text = "1.0.0", style = MaterialTheme.typography.bodyMedium, color = TextMuted)
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // Sign out
            Button(
                onClick = {
                    scope.launch {
                        authRepo.signOut()
                        onSignedOut()
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = RedAccent.copy(alpha = 0.15f),
                    contentColor = RedAccent
                )
            ) {
                Text(text = "Sign Out", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}
