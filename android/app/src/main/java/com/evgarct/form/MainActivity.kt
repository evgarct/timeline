package com.evgarct.form

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
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
import com.evgarct.form.core.theme.FormTheme
import com.evgarct.form.core.theme.Ink
import com.evgarct.form.ui.auth.AuthScreen
import com.evgarct.form.ui.components.LoadingSpinner
import com.evgarct.form.ui.shell.RootScreen
import kotlinx.coroutines.launch

sealed class AppSessionState {
    object Restoring : AppSessionState()
    object SignedIn : AppSessionState()
    object SignedOut : AppSessionState()
}

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            FormTheme {
                MainContent()
            }
        }
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
