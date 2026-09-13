package com.evgarct.form.ui.export

import android.content.Intent
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.IosShare
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evgarct.form.FormApp
import com.evgarct.form.data.models.FoodEntry
import com.evgarct.form.data.models.NutritionGoals
import com.evgarct.form.data.models.NutritionSummary
import com.evgarct.form.ui.nutrition.MacroColumns
import com.evgarct.form.ui.nutrition.MacroColumnsHeader
import com.evgarct.form.ui.nutrition.report.NutritionReportBuilder
import com.evgarct.form.ui.nutrition.report.NutritionReportRenderer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Standalone Export tab: generates and shares the same day's PDF/OG report that
 * used to be triggered from a small button inside Nutrition. Fetches its own
 * data for whatever date is selected — independent of the Nutrition screen.
 */
@Composable
fun ExportScreen() {
    val nutritionRepo = FormApp.instance.nutritionRepository
    val healthRepo = FormApp.instance.healthConnectRepository
    val prefs = FormApp.instance.appPreferences
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var selectedDate by remember { mutableStateOf(Date()) }
    var entries by remember { mutableStateOf<List<FoodEntry>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var isExporting by remember { mutableStateOf(false) }

    fun loadEntries() {
        isLoading = true
        scope.launch {
            nutritionRepo.getEntries(selectedDate, TimeZone.getDefault())
                .onSuccess { entries = it; isLoading = false }
                .onFailure { isLoading = false }
        }
    }

    LaunchedEffect(selectedDate) { loadEntries() }

    fun moveDay(offset: Int) {
        val cal = Calendar.getInstance().apply {
            time = selectedDate
            add(Calendar.DAY_OF_YEAR, offset)
        }
        selectedDate = cal.time
    }

    fun isToday(d: Date): Boolean {
        val cal1 = Calendar.getInstance().apply { time = d }
        val cal2 = Calendar.getInstance()
        return cal1.get(Calendar.YEAR) == cal2.get(Calendar.YEAR) &&
            cal1.get(Calendar.DAY_OF_YEAR) == cal2.get(Calendar.DAY_OF_YEAR)
    }

    val dateLabel = remember(selectedDate) {
        if (isToday(selectedDate)) "Today" else SimpleDateFormat("d MMM", Locale.getDefault()).format(selectedDate)
    }

    val daySummary = remember(entries) { NutritionSummary.fromEntries(entries) }

    fun exportReport() {
        if (isExporting || entries.isEmpty()) return
        isExporting = true
        scope.launch {
            try {
                val reportLocale = Locale(prefs.reportLanguage)
                val payload = NutritionReportBuilder.buildPayload(
                    selectedDate = selectedDate,
                    entries = entries,
                    timezone = TimeZone.getDefault(),
                    stepGoal = prefs.stepGoal,
                    goals = NutritionGoals(
                        calories = prefs.nutritionGoals.calories,
                        protein = prefs.nutritionGoals.protein,
                        fat = prefs.nutritionGoals.fat,
                        carbohydrates = prefs.nutritionGoals.carbohydrates
                    ),
                    nutritionRepo = nutritionRepo,
                    healthRepo = healthRepo
                )

                val pdfBytes = withContext(Dispatchers.Default) {
                    NutritionReportRenderer.renderPdf(context, payload, reportLocale)
                }
                val ogBytes = withContext(Dispatchers.Default) {
                    NutritionReportRenderer.renderOgImage(context, payload, reportLocale)
                }

                nutritionRepo.submitReport(
                    pdfBytes = pdfBytes,
                    ogImageBytes = ogBytes,
                    reportDate = selectedDate,
                    timezone = TimeZone.getDefault()
                ).onSuccess { shareUrl ->
                    isExporting = false
                    val df = SimpleDateFormat("EEEE, d MMMM", Locale("ru"))
                    val shareText = "Привет! Отчет за ${df.format(selectedDate)}\n$shareUrl"
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, shareText)
                    }
                    context.startActivity(Intent.createChooser(intent, null))
                }.onFailure { err ->
                    isExporting = false
                    Toast.makeText(context, err.localizedMessage ?: "Failed to export report", Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                isExporting = false
                Toast.makeText(context, e.localizedMessage ?: "Failed to export report", Toast.LENGTH_LONG).show()
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .padding(horizontal = 24.dp)
                .padding(top = 16.dp, bottom = 110.dp),
            verticalArrangement = Arrangement.spacedBy(28.dp)
        ) {
            Text(
                text = "Export",
                fontSize = 34.sp,
                fontFamily = FontFamily.Serif,
                letterSpacing = (-0.8).sp,
                color = MaterialTheme.colorScheme.onBackground
            )

            // Day stepper capsule
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center
            ) {
                Box(
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.onBackground.copy(alpha = 0.12f))
                        .padding(horizontal = 6.dp, vertical = 4.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier.size(32.dp).clickable { moveDay(-1) },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                                contentDescription = "Previous Day",
                                tint = MaterialTheme.colorScheme.onBackground,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                        Text(
                            text = dateLabel,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Medium,
                            color = MaterialTheme.colorScheme.onBackground,
                            modifier = Modifier.padding(horizontal = 12.dp)
                        )
                        val canGoForward = !isToday(selectedDate)
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clickable(enabled = canGoForward) { moveDay(1) },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Rounded.ArrowForward,
                                contentDescription = "Next Day",
                                tint = if (canGoForward) {
                                    MaterialTheme.colorScheme.onBackground
                                } else {
                                    MaterialTheme.colorScheme.onBackground.copy(alpha = 0.25f)
                                },
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }

            // Totals preview
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                MacroColumnsHeader()
                MacroColumns(summary = daySummary, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
            }

            Box(modifier = Modifier.fillMaxWidth())

            // Primary export CTA
            val isExportDisabled = entries.isEmpty() || isExporting
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(22.dp))
                    .background(
                        if (isExportDisabled) {
                            MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f)
                        } else {
                            MaterialTheme.colorScheme.onBackground.copy(alpha = 0.15f)
                        }
                    )
                    .clickable(enabled = !isExportDisabled) { exportReport() }
                    .padding(vertical = 16.dp),
                contentAlignment = Alignment.Center
            ) {
                if (isExporting) {
                    CircularProgressIndicator(
                        color = MaterialTheme.colorScheme.onBackground,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(20.dp)
                    )
                } else {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.IosShare,
                            contentDescription = null,
                            tint = if (isExportDisabled) {
                                MaterialTheme.colorScheme.onBackground.copy(alpha = 0.3f)
                            } else {
                                MaterialTheme.colorScheme.onBackground
                            },
                            modifier = Modifier.size(20.dp)
                        )
                        Text(
                            text = "Export & Share",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (isExportDisabled) {
                                MaterialTheme.colorScheme.onBackground.copy(alpha = 0.3f)
                            } else {
                                MaterialTheme.colorScheme.onBackground
                            }
                        )
                    }
                }
            }

            if (entries.isEmpty() && !isLoading) {
                Text(
                    text = "Nothing logged for this day yet.",
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
                )
            }
        }
    }
}
