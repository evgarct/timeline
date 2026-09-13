package com.evgarct.form.ui.nutrition

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.evgarct.form.FormApp
import com.evgarct.form.core.preferences.StoredNutritionGoals
import com.evgarct.form.core.theme.LightInk
import com.evgarct.form.core.theme.SurfaceCard
import com.evgarct.form.core.theme.SurfaceCardBorder
import com.evgarct.form.core.theme.TextMuted
import com.evgarct.form.core.theme.TextSecondary
import com.evgarct.form.core.theme.Trace
import com.evgarct.form.ui.nutrition.components.FormModalSheet

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NutritionGoalsSheet(
    onDismiss: () -> Unit,
    onSaved: () -> Unit
) {
    val prefs = FormApp.instance.appPreferences
    val current = prefs.nutritionGoals

    var calories by remember { mutableStateOf(current.calories?.toInt()?.toString() ?: "") }
    var protein by remember { mutableStateOf(current.protein?.toInt()?.toString() ?: "") }
    var fat by remember { mutableStateOf(current.fat?.toInt()?.toString() ?: "") }
    var carbs by remember { mutableStateOf(current.carbohydrates?.toInt()?.toString() ?: "") }

    fun save() {
        prefs.nutritionGoals = StoredNutritionGoals(
            calories = calories.toDoubleOrNull(),
            protein = protein.toDoubleOrNull(),
            fat = fat.toDoubleOrNull(),
            carbohydrates = carbs.toDoubleOrNull()
        )
        onSaved()
    }

    FormModalSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .imePadding()
                .padding(bottom = 24.dp, start = 20.dp, end = 20.dp)
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
                    text = "Cancel",
                    style = MaterialTheme.typography.bodyLarge,
                    color = TextSecondary,
                    modifier = Modifier.clickable { onDismiss() }
                )

                Text(
                    text = "Daily Goals",
                    style = MaterialTheme.typography.titleMedium,
                    color = LightInk
                )

                Text(
                    text = "Save",
                    style = MaterialTheme.typography.titleSmall,
                    color = Trace,
                    modifier = Modifier.clickable { save() }
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Set your personal daily targets. All fields are optional.",
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary
            )

            Spacer(modifier = Modifier.height(24.dp))

            GoalInputField(label = "Calories", unit = "kcal", value = calories, onValueChange = { calories = it })
            GoalInputField(label = "Protein", unit = "g", value = protein, onValueChange = { protein = it })
            GoalInputField(label = "Fat", unit = "g", value = fat, onValueChange = { fat = it })
            GoalInputField(label = "Carbohydrates", unit = "g", value = carbs, onValueChange = { carbs = it })
        }
    }
}

@Composable
fun GoalInputField(
    label: String,
    unit: String,
    value: String,
    onValueChange: (String) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, style = MaterialTheme.typography.bodyLarge, color = LightInk)

        OutlinedTextField(
            value = value,
            onValueChange = { if (it.isEmpty() || it.all { c -> c.isDigit() }) onValueChange(it) },
            modifier = Modifier.width(120.dp),
            placeholder = { Text(unit, color = TextMuted) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            shape = RoundedCornerShape(10.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = SurfaceCard,
                unfocusedContainerColor = SurfaceCard,
                focusedBorderColor = Trace,
                unfocusedBorderColor = SurfaceCardBorder,
                focusedTextColor = LightInk,
                unfocusedTextColor = LightInk
            )
        )
    }
}
