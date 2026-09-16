package com.evgarct.form

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.evgarct.form.core.theme.FormTheme
import com.evgarct.form.core.theme.Ink
import com.evgarct.form.ui.auth.AuthScreen
import com.evgarct.form.ui.components.LoadingSpinner
import com.evgarct.form.ui.shell.RootScreen
import com.evgarct.form.work.NutritionSyncWorker
import kotlinx.coroutines.launch

sealed class AppSessionState {
    object Restoring : AppSessionState()
    object SignedIn : AppSessionState()
    object SignedOut : AppSessionState()
}

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            FormTheme {
                MainContent()
            }
        }
    }

    override fun onStart() {
        super.onStart()
        // Nutrition entries logged via MCP (outside the app) never trigger the live
        // NutritionRepository sync — this is the point where the app can catch up on those.
        // The worker itself no-ops if the Health Connect sync toggle is off, so this is safe
        // to enqueue unconditionally on every foreground.
        WorkManager.getInstance(this).enqueueUniqueWork(
            "nutrition-foreground-sync",
            ExistingWorkPolicy.KEEP,
            OneTimeWorkRequestBuilder<NutritionSyncWorker>()
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .build()
        )
    }
}

@Composable
fun MainContent() {
    val authRepo = FormApp.instance.authRepository
    val scope = rememberCoroutineScope()
    var sessionState by remember { mutableStateOf<AppSessionState>(AppSessionState.Restoring) }

    LaunchedEffect(Unit) {
        val hasSession = authRepo.hasSession()
        sessionState = if (hasSession) AppSessionState.SignedIn else AppSessionState.SignedOut
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Ink)
    ) {
        when (sessionState) {
            is AppSessionState.Restoring -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    LoadingSpinner()
                }
            }
            is AppSessionState.SignedOut -> {
                AuthScreen(
                    onSignedIn = {
                        sessionState = AppSessionState.SignedIn
                    }
                )
            }
            is AppSessionState.SignedIn -> {
                RootScreen(
                    onSignOut = {
                        sessionState = AppSessionState.SignedOut
                    }
                )
            }
        }
    }
}
