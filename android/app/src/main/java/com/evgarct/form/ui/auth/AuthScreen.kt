package com.evgarct.form.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evgarct.form.FormApp
import com.evgarct.form.R
import com.evgarct.form.core.theme.Ink
import com.evgarct.form.core.theme.LightInk
import com.evgarct.form.core.theme.RedAccent
import com.evgarct.form.core.theme.SurfaceCard
import com.evgarct.form.core.theme.SurfaceCardBorder
import com.evgarct.form.core.theme.TextMuted
import com.evgarct.form.core.theme.TextSecondary
import com.evgarct.form.core.theme.Trace
import kotlinx.coroutines.launch

@Composable
fun AuthScreen(
    onSignedIn: () -> Unit
) {
    val authRepo = FormApp.instance.authRepository
    val scope = rememberCoroutineScope()
    val focusManager = LocalFocusManager.current

    var stage by remember { mutableStateOf(1) } // 1 = Email, 2 = OTP
    var email by remember { mutableStateOf("") }
    var otp by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    fun sendCode() {
        if (!email.contains("@")) {
            errorMessage = "Please enter a valid email address."
            return
        }
        isLoading = true
        errorMessage = null
        focusManager.clearFocus()
        scope.launch {
            authRepo.requestOtp(email)
                .onSuccess {
                    isLoading = false
                    stage = 2
                }
                .onFailure {
                    isLoading = false
                    errorMessage = it.message ?: "Could not send verification code"
                }
        }
    }

    fun verifyCode() {
        if (otp.length < 4) {
            errorMessage = "Please enter a valid verification code."
            return
        }
        isLoading = true
        errorMessage = null
        focusManager.clearFocus()
        scope.launch {
            authRepo.verifyOtp(email, otp)
                .onSuccess {
                    isLoading = false
                    onSignedIn()
                }
                .onFailure {
                    isLoading = false
                    errorMessage = "Verification rejected. Check the code and try again."
                }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Ink)
            .imePadding()
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                painter = painterResource(id = R.drawable.ic_trace_primary),
                contentDescription = "Brand Mark",
                tint = androidx.compose.ui.graphics.Color.Unspecified,
                modifier = Modifier.size(72.dp)
            )

            Spacer(modifier = Modifier.height(32.dp))

            Text(
                text = "Form",
                fontFamily = FontFamily.Serif,
                fontSize = 36.sp,
                fontWeight = FontWeight.Normal,
                color = LightInk
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = if (stage == 1) "Enter your email to sign in" else "Enter the code sent to $email",
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(32.dp))

            if (stage == 1) {
                OutlinedTextField(
                    value = email,
                    onValueChange = {
                        email = it
                        errorMessage = null
                    },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("email@example.com", color = TextMuted) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Email,
                        imeAction = ImeAction.Done,
                        autoCorrectEnabled = false
                    ),
                    keyboardActions = KeyboardActions(onDone = { if (email.isNotBlank()) sendCode() }),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = SurfaceCard,
                        unfocusedContainerColor = SurfaceCard,
                        focusedBorderColor = Trace,
                        unfocusedBorderColor = SurfaceCardBorder,
                        focusedTextColor = LightInk,
                        unfocusedTextColor = LightInk
                    )
                )

                if (errorMessage != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = errorMessage ?: "",
                        style = MaterialTheme.typography.bodySmall,
                        color = RedAccent,
                        textAlign = TextAlign.Start,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                Button(
                    onClick = { sendCode() },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp),
                    enabled = email.isNotBlank() && !isLoading,
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Trace,
                        disabledContainerColor = SurfaceCardBorder,
                        contentColor = LightInk,
                        disabledContentColor = TextMuted
                    )
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = LightInk,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text(
                            text = "Send code",
                            style = MaterialTheme.typography.labelLarge
                        )
                    }
                }
            } else {
                OutlinedTextField(
                    value = otp,
                    onValueChange = {
                        otp = it.filter { char -> char.isDigit() }.take(6)
                        errorMessage = null
                    },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("123456", color = TextMuted) },
                    singleLine = true,
                    textStyle = TextStyle(
                        fontFamily = FontFamily.Monospace,
                        fontSize = 22.sp,
                        letterSpacing = 4.sp,
                        textAlign = TextAlign.Center,
                        color = LightInk
                    ),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Number,
                        imeAction = ImeAction.Done
                    ),
                    keyboardActions = KeyboardActions(onDone = { if (otp.length >= 4) verifyCode() }),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = SurfaceCard,
                        unfocusedContainerColor = SurfaceCard,
                        focusedBorderColor = Trace,
                        unfocusedBorderColor = SurfaceCardBorder,
                        focusedTextColor = LightInk,
                        unfocusedTextColor = LightInk
                    )
                )

                if (errorMessage != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = errorMessage ?: "",
                        style = MaterialTheme.typography.bodySmall,
                        color = RedAccent,
                        textAlign = TextAlign.Start,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                Button(
                    onClick = { verifyCode() },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp),
                    enabled = otp.length >= 4 && !isLoading,
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Trace,
                        disabledContainerColor = SurfaceCardBorder,
                        contentColor = LightInk,
                        disabledContentColor = TextMuted
                    )
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = LightInk,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text(
                            text = "Verify",
                            style = MaterialTheme.typography.labelLarge
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "Change email",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Trace,
                    modifier = Modifier.clickable {
                        stage = 1
                        otp = ""
                        errorMessage = null
                    }
                )
            }
        }
    }
}
