package com.evgarct.form.ui.nutrition

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BakeryDining
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evgarct.form.FormApp
import com.evgarct.form.core.preferences.StoredNutritionGoals
import com.evgarct.form.core.theme.TextMuted
import com.evgarct.form.core.theme.TextPrimary
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

    FormModalSheet(onDismissRequest = onDismiss, title = "Daily goals") {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .imePadding()
                .padding(bottom = 24.dp, start = 20.dp, end = 20.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = "Optional — leave a field blank to skip that target.",
                fontSize = 13.sp,
                color = TextMuted
            )

            Spacer(modifier = Modifier.height(4.dp))

            GoalInputField(icon = Icons.Default.LocalFireDepartment, label = "Calories", unit = "kcal", value = calories, onValueChange = { calories = it })
            GoalInputField(icon = Icons.Default.FitnessCenter, label = "Protein", unit = "g", value = protein, onValueChange = { protein = it })
            GoalInputField(icon = Icons.Default.WaterDrop, label = "Fat", unit = "g", value = fat, onValueChange = { fat = it })
            GoalInputField(icon = Icons.Default.BakeryDining, label = "Carbohydrates", unit = "g", value = carbs, onValueChange = { carbs = it })

            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = { save() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    contentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            ) {
                Text("Save", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
fun GoalInputField(
    icon: ImageVector,
    label: String,
    unit: String,
    value: String,
    onValueChange: (String) -> Unit
) {
    val colorScheme = MaterialTheme.colorScheme
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(colorScheme.surfaceContainer)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(colorScheme.secondaryContainer),
            contentAlignment = Alignment.Center
        ) {
            Icon(imageVector = icon, contentDescription = null, tint = colorScheme.onSecondaryContainer, modifier = Modifier.size(18.dp))
        }

        Text(text = label, fontSize = 15.sp, color = TextPrimary, modifier = Modifier.weight(1f))

        Box(
            modifier = Modifier
                .width(96.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(colorScheme.surfaceContainerHigh)
                .padding(horizontal = 10.dp, vertical = 8.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.End, modifier = Modifier.fillMaxWidth()) {
                BasicTextField(
                    value = value,
                    onValueChange = { if (it.isEmpty() || it.all { c -> c.isDigit() }) onValueChange(it) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    textStyle = TextStyle(
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Medium,
                        color = TextPrimary,
                        textAlign = TextAlign.End
                    ),
                    cursorBrush = SolidColor(TextPrimary),
                    modifier = Modifier.weight(1f, fill = false)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(text = unit, fontSize = 12.sp, color = TextMuted)
            }
        }
    }
}
