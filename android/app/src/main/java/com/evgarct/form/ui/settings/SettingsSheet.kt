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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evgarct.form.FormApp
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
            .background(Color(0xFF13110E))
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
                    color = Color.White
                )

                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.12f))
                        .clickable { onDismiss() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Close",
                        tint = Color.White,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // App Language Section
            Text(
                text = "APP LANGUAGE",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.2.sp,
                color = Color.White.copy(alpha = 0.4f)
            )
            Spacer(modifier = Modifier.height(8.dp))

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White.copy(alpha = 0.05f))
            ) {
                languages.forEachIndexed { index, (code, name) ->
                    val isSelected = appLanguage == code
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                appLanguage = code
                                prefs.appLanguage = code
                            }
                            .padding(horizontal = 18.dp, vertical = 14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = name,
                            fontSize = 16.sp,
                            color = Color.White
                        )
                        if (isSelected) {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                    if (index < languages.size - 1) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 18.dp)
                                .height(1.dp)
                                .background(Color.White.copy(alpha = 0.06f))
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(28.dp))

            // Report Language Section
            Text(
                text = "REPORT LANGUAGE",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.2.sp,
                color = Color.White.copy(alpha = 0.4f)
            )
            Spacer(modifier = Modifier.height(8.dp))

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White.copy(alpha = 0.05f))
            ) {
                languages.forEachIndexed { index, (code, name) ->
                    val isSelected = reportLanguage == code
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                reportLanguage = code
                                prefs.reportLanguage = code
                            }
                            .padding(horizontal = 18.dp, vertical = 14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = name,
                            fontSize = 16.sp,
                            color = Color.White
                        )
                        if (isSelected) {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                    if (index < languages.size - 1) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 18.dp)
                                .height(1.dp)
                                .background(Color.White.copy(alpha = 0.06f))
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(28.dp))

            // About Section
            Text(
                text = "ABOUT",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.2.sp,
                color = Color.White.copy(alpha = 0.4f)
            )
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White.copy(alpha = 0.05f))
                    .padding(horizontal = 18.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(text = "Form", fontSize = 16.sp, color = Color.White)
                Text(text = "0.1.0", fontSize = 15.sp, color = Color.White.copy(alpha = 0.5f))
            }

            Spacer(modifier = Modifier.height(36.dp))

            // Sign out Button
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .background(Color(0x22FF453A))
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
                    color = Color(0xFFFF453A)
                )
            }

            Spacer(modifier = Modifier.height(36.dp))
        }
    }
}
