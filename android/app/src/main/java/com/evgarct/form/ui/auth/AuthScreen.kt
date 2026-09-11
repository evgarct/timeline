package com.evgarct.form.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalFocusManager
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
import kotlinx.coroutines.launch

@Composable
fun AuthScreen(
    onSignedIn: () -> Unit
) {
    val authRepo = FormApp.instance.authRepository
    val scope = rememberCoroutineScope()
    val focusManager = LocalFocusManager.current

    var stage by remember { mutableStateOf(1) } // 1 = Email, 2 = Code
    var email by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    fun submit() {
        errorMessage = null
        focusManager.clearFocus()

        if (stage == 1) {
            val cleanEmail = email.trim()
            if (!cleanEmail.contains("@") || !cleanEmail.contains(".")) {
                errorMessage = "Please enter a valid email address."
                return
            }
            isLoading = true
            scope.launch {
                authRepo.requestOtp(cleanEmail)
                    .onSuccess {
                        isLoading = false
                        stage = 2
                    }
                    .onFailure {
                        isLoading = false
                        errorMessage = it.message ?: "Authentication service unavailable"
                    }
            }
        } else {
            val cleanCode = code.trim()
            if (cleanCode.length < 4) {
                errorMessage = "Please enter the verification code."
                return
            }
            isLoading = true
            scope.launch {
                authRepo.verifyOtp(email.trim(), cleanCode)
                    .onSuccess {
                        isLoading = false
                        onSignedIn()
                    }
                    .onFailure {
                        isLoading = false
                        errorMessage = it.message ?: "Invalid or expired code"
                    }
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color.Black,
                        Color(0xFF29211A)
                    )
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(28.dp)
                .imePadding(),
            horizontalAlignment = Alignment.Start
        ) {
            Spacer(modifier = Modifier.weight(1f))

            Text(
                text = stringResource(R.string.auth_brand),
                fontSize = 64.sp,
                fontWeight = FontWeight.Normal,
                fontFamily = FontFamily.Serif,
                color = Color.White
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = if (stage == 1) stringResource(R.string.auth_intro) else stringResource(R.string.auth_code_intro),
                fontSize = 20.sp,
                color = Color.White.copy(alpha = 0.6f)
            )

            Spacer(modifier = Modifier.height(28.dp))

            if (stage == 1) {
                BasicTextField(
                    value = email,
                    onValueChange = {
                        email = it
                        errorMessage = null
                    },
                    textStyle = TextStyle(
                        color = Color.White,
                        fontSize = 17.sp
                    ),
                    cursorBrush = SolidColor(Color.White),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Email,
                        imeAction = ImeAction.Go
                    ),
                    keyboardActions = KeyboardActions(onGo = { submit() }),
                    decorationBox = { innerTextField ->
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(18.dp))
                                .background(Color.White.copy(alpha = 0.12f))
                                .padding(horizontal = 18.dp, vertical = 18.dp),
                            contentAlignment = Alignment.CenterStart
                        ) {
                            if (email.isEmpty()) {
                                Text(
                                    text = stringResource(R.string.auth_email),
                                    style = TextStyle(
                                        color = Color.White.copy(alpha = 0.4f),
                                        fontSize = 17.sp
                                    )
                                )
                            }
                            innerTextField()
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                )
            } else {
                BasicTextField(
                    value = code,
                    onValueChange = {
                        if (it.length <= 8) {
                            code = it
                            errorMessage = null
                        }
                    },
                    textStyle = TextStyle(
                        color = Color.White,
                        fontSize = 26.sp,
                        fontFamily = FontFamily.Monospace,
                        textAlign = TextAlign.Center
                    ),
                    cursorBrush = SolidColor(Color.White),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Number,
                        imeAction = ImeAction.Go
                    ),
                    keyboardActions = KeyboardActions(onGo = { submit() }),
                    decorationBox = { innerTextField ->
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(18.dp))
                                .background(Color.White.copy(alpha = 0.12f))
                                .padding(horizontal = 18.dp, vertical = 16.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            if (code.isEmpty()) {
                                Text(
                                    text = stringResource(R.string.auth_code),
                                    style = TextStyle(
                                        color = Color.White.copy(alpha = 0.4f),
                                        fontSize = 22.sp,
                                        textAlign = TextAlign.Center
                                    )
                                )
                            }
                            innerTextField()
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                )
            }

            if (errorMessage != null) {
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = errorMessage!!,
                    color = Color(0xFFFF453A),
                    fontSize = 13.sp
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            Button(
                onClick = { submit() },
                enabled = !isLoading && (if (stage == 1) email.isNotBlank() else code.isNotBlank()),
                shape = RoundedCornerShape(18.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.White.copy(alpha = 0.22f),
                    contentColor = Color.White,
                    disabledContainerColor = Color.White.copy(alpha = 0.08f),
                    disabledContentColor = Color.White.copy(alpha = 0.3f)
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            color = Color.White,
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                    }
                    Text(
                        text = if (stage == 1) stringResource(R.string.auth_send) else stringResource(R.string.auth_verify),
                        fontSize = 17.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }

            if (stage == 2) {
                Spacer(modifier = Modifier.height(12.dp))
                TextButton(
                    onClick = {
                        stage = 1
                        code = ""
                        errorMessage = null
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = stringResource(R.string.auth_changeemail),
                        color = Color.White.copy(alpha = 0.7f),
                        fontSize = 15.sp
                    )
                }
            }

            Spacer(modifier = Modifier.weight(1f))
        }
    }
}
