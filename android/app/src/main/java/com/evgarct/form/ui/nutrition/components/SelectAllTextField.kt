package com.evgarct.form.ui.nutrition.components

import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue

/**
 * A numeric [BasicTextField] that selects its entire value when it gains focus, so typing
 * immediately replaces the old number instead of requiring the user to clear it first.
 */
@Composable
fun SelectAllOnFocusTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    textStyle: TextStyle,
    cursorColor: Color,
    keyboardOptions: KeyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
    singleLine: Boolean = true
) {
    var fieldValue by remember { mutableStateOf(TextFieldValue(value, selection = TextRange(value.length))) }
    // The tap that focuses the field also delivers its own cursor-placement onValueChange
    // (positioned at the tap offset), which would otherwise overwrite a select-all applied
    // in onFocusChanged. This flag forces the *next* onValueChange after gaining focus to
    // select everything instead of trusting that tap-derived collapsed cursor position.
    var pendingSelectAll by remember { mutableStateOf(false) }

    // Keep in sync when the value changes from outside (e.g. a +/- stepper button).
    LaunchedEffect(value) {
        if (value != fieldValue.text) {
            fieldValue = TextFieldValue(value, selection = TextRange(value.length))
        }
    }

    BasicTextField(
        value = fieldValue,
        onValueChange = { new ->
            fieldValue = if (pendingSelectAll) {
                pendingSelectAll = false
                new.copy(selection = TextRange(0, new.text.length))
            } else {
                new
            }
            onValueChange(fieldValue.text)
        },
        modifier = modifier.onFocusChanged { state ->
            if (state.isFocused) {
                pendingSelectAll = true
                fieldValue = fieldValue.copy(selection = TextRange(0, fieldValue.text.length))
            }
        },
        singleLine = singleLine,
        keyboardOptions = keyboardOptions,
        textStyle = textStyle,
        cursorBrush = SolidColor(cursorColor)
    )
}
