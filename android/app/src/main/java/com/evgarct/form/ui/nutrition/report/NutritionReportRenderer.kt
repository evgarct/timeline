package com.evgarct.form.ui.nutrition.report

import android.content.Context
import android.content.res.Configuration
import android.content.res.Resources
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import androidx.core.content.ContextCompat
import com.evgarct.form.R
import com.evgarct.form.data.models.FoodEntry
import com.evgarct.form.data.models.FoodQuantity
import com.evgarct.form.data.models.GoalStatus
import com.evgarct.form.data.models.MealType
import com.evgarct.form.data.models.NutritionReportPayload
import com.evgarct.form.data.models.NutritionSummary
import java.io.ByteArrayOutputStream
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

object NutritionReportRenderer {

    // Palette matching iOS ActivityPalette(colorScheme: .light) & Brand.swift
    private const val COLOR_PAPER = 0xFFF2EEE6.toInt()
    private const val COLOR_INK = 0xFF151310.toInt()
    private const val COLOR_MUTED = 0x85151310.toInt() // 52% alpha
    private const val COLOR_ACCENT = 0xFF806451.toInt()
    private const val COLOR_TRACK = 0x1F151310.toInt() // 12% alpha
    private const val COLOR_MEAL_BAND = 0x12151310.toInt() // 7% alpha

    fun renderPdf(context: Context, payload: NutritionReportPayload, locale: Locale): ByteArray {
        val res = getLocalizedResources(context, locale)
        val document = PdfDocument()

        // Page 1: Cover Page (Fixed 1600 x 1000)
        val coverInfo = PdfDocument.PageInfo.Builder(1600, 1000, 1).create()
        val coverPage = document.startPage(coverInfo)
        drawCoverPage(context, coverPage.canvas, payload, locale, res)
        document.finishPage(coverPage)

        // Page 2: Detail Page (1600 x Dynamic Height)
        val detailHeight = calculateDetailPageHeight(payload)
        val detailInfo = PdfDocument.PageInfo.Builder(1600, detailHeight, 2).create()
        val detailPage = document.startPage(detailInfo)
        drawDetailPage(context, detailPage.canvas, payload, detailHeight, locale, res)
        document.finishPage(detailPage)

        val output = ByteArrayOutputStream()
        document.writeTo(output)
        document.close()
        return output.toByteArray()
    }

    fun renderOgImage(context: Context, payload: NutritionReportPayload, locale: Locale): ByteArray {
        val res = getLocalizedResources(context, locale)
        val bitmap = Bitmap.createBitmap(1200, 630, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        canvas.drawColor(COLOR_PAPER)

        // Brand mark 76x76
        drawBrandMark(context, canvas, 64f, 64f, 76)

        // Date on right
        val dateStr = formatCoverDate(payload.date, locale)
        val datePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED
            textSize = 28f
            typeface = Typeface.SERIF
            textAlign = Paint.Align.RIGHT
        }
        canvas.drawText(dateStr, 1200f - 64f, 105f, datePaint)

        // 3 Columns in content area (Y: 180 to 560)
        val hasActivity = payload.activity != null
        val colWidth = if (hasActivity) 310f else 480f
        val startY = 220f

        var curX = 64f

        if (hasActivity) {
            val activity = payload.activity!!
            // Steps column
            val stepsTitlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = COLOR_ACCENT
                textSize = 24f
                typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
            }
            canvas.drawText(res.getString(R.string.nutrition_report_activity_steps).uppercase(locale), curX, startY, stepsTitlePaint)

            val stepsFigurePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = COLOR_INK
                textSize = 80f
                typeface = Typeface.SERIF
            }
            canvas.drawText(String.format(locale, "%,d", activity.steps).replace(',', ' '), curX, startY + 90f, stepsFigurePaint)

            curX += colWidth
            // Divider
            val divPaint = Paint().apply { color = COLOR_TRACK; strokeWidth = 2f }
            canvas.drawLine(curX, startY - 20f, curX, startY + 220f, divPaint)
            curX += 40f
        }

        // Calories column
        val kcalTitlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_ACCENT
            textSize = 24f
            typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        }
        canvas.drawText(res.getString(R.string.summary_calories_unit).uppercase(locale), curX, startY, kcalTitlePaint)

        val kcalFigurePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_INK
            textSize = 80f
            typeface = Typeface.SERIF
        }
        val calStr = String.format(Locale.US, "%.0f", payload.summary.calories)
        canvas.drawText(calStr, curX, startY + 90f, kcalFigurePaint)

        curX += colWidth
        // Divider
        val divPaint = Paint().apply { color = COLOR_TRACK; strokeWidth = 2f }
        canvas.drawLine(curX, startY - 20f, curX, startY + 220f, divPaint)
        curX += 40f

        // Macros column
        val macroFigurePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_INK
            textSize = 36f
            typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        }
        val macroLabelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED
            textSize = 20f
            typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        }

        var macroY = startY + 10f
        val macroSpacing = 68f

        // Protein
        canvas.drawText(String.format(Locale.US, "%.0f g", payload.summary.protein), curX, macroY, macroFigurePaint)
        canvas.drawText(res.getString(R.string.nutrition_protein_short).uppercase(locale), curX + 160f, macroY, macroLabelPaint)

        macroY += macroSpacing
        // Fat
        canvas.drawText(String.format(Locale.US, "%.0f g", payload.summary.fat), curX, macroY, macroFigurePaint)
        canvas.drawText(res.getString(R.string.nutrition_fat_short).uppercase(locale), curX + 160f, macroY, macroLabelPaint)

        macroY += macroSpacing
        // Carbs
        canvas.drawText(String.format(Locale.US, "%.0f g", payload.summary.carbohydrates), curX, macroY, macroFigurePaint)
        canvas.drawText(res.getString(R.string.nutrition_carbohydrates_short).uppercase(locale), curX + 160f, macroY, macroLabelPaint)

        val out = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, 85, out)
        return out.toByteArray()
    }

    private fun drawCoverPage(
        context: Context,
        canvas: Canvas,
        payload: NutritionReportPayload,
        locale: Locale,
        res: Resources
    ) {
        canvas.drawColor(COLOR_PAPER)

        // Header: Brand mark 88x88 + Date string
        drawBrandMark(context, canvas, 64f, 64f, 88)

        val dateStr = formatCoverDate(payload.date, locale)
        val datePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED
            textSize = 26f
            typeface = Typeface.SERIF
            textAlign = Paint.Align.RIGHT
        }
        canvas.drawText(dateStr, 1600f - 64f, 115f, datePaint)

        val hasActivity = payload.activity != null
        val columnGap = 64f
        val leftX = 64f
        val contentY = 210f

        if (hasActivity) {
            val colWidth = (1600f - 128f - columnGap) / 2f
            val rightX = leftX + colWidth + columnGap

            // Left: Activity
            drawCoverActivityColumn(canvas, leftX, contentY, colWidth, payload, locale, res)

            // Vertical separator
            val sepPaint = Paint().apply {
                color = COLOR_TRACK
                strokeWidth = 1.5f
            }
            val dividerX = leftX + colWidth + (columnGap / 2f)
            canvas.drawLine(dividerX, contentY, dividerX, 936f, sepPaint)

            // Right: Nutrition
            drawCoverNutritionColumn(canvas, rightX, contentY, colWidth, payload, locale, res)
        } else {
            // Full width Nutrition
            drawCoverNutritionColumn(canvas, leftX, contentY, 1600f - 128f, payload, locale, res)
        }
    }

    private fun drawCoverActivityColumn(
        canvas: Canvas,
        x: Float,
        y: Float,
        width: Float,
        payload: NutritionReportPayload,
        locale: Locale,
        res: Resources
    ) {
        val activity = payload.activity ?: return
        var curY = y

        // Title: "АКТИВНОСТЬ"
        val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_INK
            textSize = 24f
            typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        }
        canvas.drawText(res.getString(R.string.nutrition_report_activity_title), x, curY, titlePaint)
        curY += 60f

        // Large Steps figure: e.g. "8 420"
        val stepsPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_INK
            textSize = 84f
            typeface = Typeface.SERIF
        }
        val stepsStr = String.format(locale, "%,d", activity.steps).replace(',', ' ')
        canvas.drawText(stepsStr, x, curY + 65f, stepsPaint)
        curY += 80f

        // "ШАГИ"
        val stepsLabelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED
            textSize = 14f
            letterSpacing = 0.1f
            typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        }
        canvas.drawText(res.getString(R.string.nutrition_report_activity_steps).uppercase(locale), x, curY + 20f, stepsLabelPaint)
        curY += 60f

        // Goal row: "Цель — 10 000 шагов" and "84%"
        val goalStr = "${res.getString(R.string.nutrition_report_activity_goal_prefix).trim()} " +
                "${String.format(locale, "%,d", payload.stepGoal).replace(',', ' ')} " +
                res.getString(R.string.nutrition_report_activity_goal_suffix).trim()

        val pct = if (payload.stepGoal > 0) activity.steps.toDouble() / payload.stepGoal else 0.0
        val pctStr = String.format(locale, "%.0f%%", pct * 100)

        val goalTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED
            textSize = 18f
            typeface = Typeface.MONOSPACE
        }
        canvas.drawText(goalStr, x, curY, goalTextPaint)

        val pctPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_INK
            textSize = 18f
            typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
            textAlign = Paint.Align.RIGHT
        }
        canvas.drawText(pctStr, x + width, curY, pctPaint)
        curY += 16f

        // Goal progress bar
        val barBgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = COLOR_TRACK }
        val barFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = COLOR_ACCENT }
        val barRect = RectF(x, curY, x + width, curY + 8f)
        canvas.drawRoundRect(barRect, 4f, 4f, barBgPaint)

        val fillWidth = width * minOf(pct.toFloat(), 1f)
        if (fillWidth > 0) {
            val fillRect = RectF(x, curY, x + fillWidth, curY + 8f)
            canvas.drawRoundRect(fillRect, 4f, 4f, barFillPaint)
        }
        curY += 34f

        // Weekly Average
        val avgStr = "${res.getString(R.string.nutrition_report_activity_average_prefix).trim()} " +
                "${String.format(locale, "%,d", activity.weeklyAverage).replace(',', ' ')} " +
                res.getString(R.string.nutrition_report_activity_average_suffix).trim()
        canvas.drawText(avgStr, x, curY, goalTextPaint)
        curY += 45f

        // Activity 7-day spline chart (height 220)
        drawWeekActivityChart(canvas, x, curY, width, 220f, activity.weeklySteps, payload.stepGoal, locale)
        curY += 245f

        // Distance row
        activity.distanceMeters?.let { meters ->
            val km = meters / 1000.0
            val distStr = "${res.getString(R.string.nutrition_report_activity_distance_prefix).trim()} " +
                    String.format(locale, "%.1f km", km)
            canvas.drawText(distStr, x, curY, goalTextPaint)
        }
    }

    private fun drawCoverNutritionColumn(
        canvas: Canvas,
        x: Float,
        y: Float,
        width: Float,
        payload: NutritionReportPayload,
        locale: Locale,
        res: Resources
    ) {
        var curY = y

        // Title: "ПИТАНИЕ"
        val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_INK
            textSize = 24f
            typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        }
        canvas.drawText(res.getString(R.string.nutrition_report_nutrition_title), x, curY, titlePaint)
        curY += 60f

        // Large Calories figure: e.g. "2 150"
        val calPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_INK
            textSize = 84f
            typeface = Typeface.SERIF
        }
        val calStr = String.format(locale, "%.0f", payload.summary.calories)
        canvas.drawText(calStr, x, curY + 65f, calPaint)
        curY += 80f

        // "ККАЛ"
        val calLabelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED
            textSize = 14f
            letterSpacing = 0.1f
            typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        }
        canvas.drawText(res.getString(R.string.summary_calories_unit).uppercase(locale), x, curY + 20f, calLabelPaint)
        curY += 60f

        // Calorie Goal row (if set)
        val calorieGoal = payload.goals.calories
        val goalTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED
            textSize = 18f
            typeface = Typeface.MONOSPACE
        }
        if (calorieGoal != null && calorieGoal > 0) {
            val goalStr = "${res.getString(R.string.nutrition_report_activity_goal_prefix).trim()} " +
                    "${String.format(locale, "%,.0f", calorieGoal).replace(',', ' ')} " +
                    res.getString(R.string.summary_calories_unit).trim()
            val pct = payload.summary.calories / calorieGoal
            val pctStr = String.format(locale, "%.0f%%", pct * 100)

            canvas.drawText(goalStr, x, curY, goalTextPaint)
            val pctPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = COLOR_INK
                textSize = 18f
                typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
                textAlign = Paint.Align.RIGHT
            }
            canvas.drawText(pctStr, x + width, curY, pctPaint)
            curY += 16f

            val barBgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = COLOR_TRACK }
            val barFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = COLOR_ACCENT }
            canvas.drawRoundRect(RectF(x, curY, x + width, curY + 8f), 4f, 4f, barBgPaint)

            val fillWidth = width * minOf(pct.toFloat(), 1f)
            if (fillWidth > 0) {
                canvas.drawRoundRect(RectF(x, curY, x + fillWidth, curY + 8f), 4f, 4f, barFillPaint)
            }
            curY += 34f
        }

        // 3 Macros row (Protein, Fat, Carbs)
        val macroSpacing = minOf(width / 3f, 200f)
        var macroX = x

        // Protein
        drawMacroFigure(canvas, macroX, curY, payload.summary.protein, res.getString(R.string.nutrition_protein_short).uppercase(locale), payload.goals.protein, locale, res)
        macroX += macroSpacing

        // Fat
        drawMacroFigure(canvas, macroX, curY, payload.summary.fat, res.getString(R.string.nutrition_fat_short).uppercase(locale), payload.goals.fat, locale, res)
        macroX += macroSpacing

        // Carbs
        drawMacroFigure(canvas, macroX, curY, payload.summary.carbohydrates, res.getString(R.string.nutrition_carbohydrates_short).uppercase(locale), payload.goals.carbohydrates, locale, res)
        curY += 80f

        // Weekly Nutrition Average
        payload.weeklyNutrition?.let { weekly ->
            val avgStr = "${res.getString(R.string.nutrition_report_activity_average_prefix).trim()} " +
                    "${String.format(locale, "%,.0f", weekly.averageCalories).replace(',', ' ')} " +
                    res.getString(R.string.nutrition_report_nutrition_average_suffix).trim()
            canvas.drawText(avgStr, x, curY, goalTextPaint)
            curY += 45f

            // Weekly Nutrition Trend Chart (height 220)
            drawWeekNutritionChart(canvas, x, curY, width, 220f, weekly, calorieGoal, locale)
        }
    }

    private fun drawMacroFigure(
        canvas: Canvas,
        x: Float,
        y: Float,
        value: Double,
        label: String,
        goal: Double?,
        locale: Locale,
        res: Resources
    ) {
        val valPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_INK
            textSize = 32f
            typeface = Typeface.SERIF
        }
        val str = String.format(locale, "%.0f g", value)
        canvas.drawText(str, x, y, valPaint)

        val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED
            textSize = 13f
            letterSpacing = 0.08f
            typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        }
        canvas.drawText(label, x, y + 22f, labelPaint)

        // Goal status signal if goal set
        if (goal != null && goal > 0) {
            val status = GoalStatus.compute(value, goal)
            val signalPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = COLOR_MUTED
                textSize = 12f
                typeface = Typeface.MONOSPACE
            }
            val signalText = when (status) {
                is GoalStatus.OnTarget -> "✓ " + res.getString(R.string.nutrition_report_goal_ontarget)
                is GoalStatus.Under -> "↓ " + String.format(locale, "%.0f", status.diff) + res.getString(R.string.nutrition_report_goal_under)
                is GoalStatus.Over -> "↑ " + String.format(locale, "%.0f", status.diff) + res.getString(R.string.nutrition_report_goal_over)
            }
            canvas.drawText(signalText, x, y + 42f, signalPaint)
        }
    }

    private fun drawWeekActivityChart(
        canvas: Canvas,
        x: Float,
        y: Float,
        width: Float,
        height: Float,
        steps: List<com.evgarct.form.data.repository.DailyStepData>,
        stepGoal: Int,
        locale: Locale
    ) {
        if (steps.isEmpty()) return
        val chartBottom = y + height - 30f
        val chartTop = y + 10f
        val maxVal = maxOf(steps.maxOfOrNull { it.steps }?.toDouble() ?: 1.0, stepGoal.toDouble() * 1.1, 1000.0)

        // Dashed rule for stepGoal
        if (stepGoal > 0) {
            val goalY = chartBottom - ((stepGoal / maxVal) * (chartBottom - chartTop)).toFloat()
            val dashedPaint = Paint().apply {
                color = COLOR_TRACK
                strokeWidth = 1.5f
                style = Paint.Style.STROKE
                pathEffect = DashPathEffect(floatArrayOf(10f, 10f), 0f)
            }
            canvas.drawLine(x, goalY, x + width, goalY, dashedPaint)
        }

        val stepX = width / (steps.size - 1).coerceAtLeast(1)
        val points = steps.mapIndexed { index, data ->
            val px = x + index * stepX
            val py = chartBottom - ((data.steps.toDouble() / maxVal) * (chartBottom - chartTop)).toFloat()
            Pair(px, py)
        }

        // Draw Spline Area Gradient
        val areaPath = Path().apply {
            moveTo(points.first().first, chartBottom)
            points.forEach { lineTo(it.first, it.second) }
            lineTo(points.last().first, chartBottom)
            close()
        }
        val gradientPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = LinearGradient(
                x, chartTop, x, chartBottom,
                COLOR_ACCENT and 0x55FFFFFF,
                Color.TRANSPARENT,
                Shader.TileMode.CLAMP
            )
        }
        canvas.drawPath(areaPath, gradientPaint)

        // Draw Spline Line
        val linePath = Path().apply {
            points.forEachIndexed { i, p ->
                if (i == 0) moveTo(p.first, p.second) else lineTo(p.first, p.second)
            }
        }
        val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_ACCENT
            strokeWidth = 3f
            style = Paint.Style.STROKE
        }
        canvas.drawPath(linePath, linePaint)

        // Draw weekday labels
        val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED
            textSize = 14f
            textAlign = Paint.Align.CENTER
            typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
        }
        val dayFmt = SimpleDateFormat("EE", locale)
        steps.forEachIndexed { index, data ->
            val px = x + index * stepX
            val date = java.sql.Date.valueOf(data.date.toString())
            canvas.drawText(dayFmt.format(date).uppercase(locale), px, y + height, labelPaint)
        }
    }

    private fun drawWeekNutritionChart(
        canvas: Canvas,
        x: Float,
        y: Float,
        width: Float,
        height: Float,
        weekly: com.evgarct.form.data.models.WeeklyNutritionSnapshot,
        calorieGoal: Double?,
        locale: Locale
    ) {
        val days = weekly.days
        if (days.isEmpty()) return
        val chartBottom = y + height - 30f
        val chartTop = y + 10f
        val maxVal = maxOf(
            days.maxOfOrNull { it.summary?.calories ?: 0.0 } ?: 1.0,
            (calorieGoal ?: 0.0) * 1.1,
            1000.0
        )

        // Dashed rule for calorieGoal
        if (calorieGoal != null && calorieGoal > 0) {
            val goalY = chartBottom - ((calorieGoal / maxVal) * (chartBottom - chartTop)).toFloat()
            val dashedPaint = Paint().apply {
                color = COLOR_TRACK
                strokeWidth = 1.5f
                style = Paint.Style.STROKE
                pathEffect = DashPathEffect(floatArrayOf(10f, 10f), 0f)
            }
            canvas.drawLine(x, goalY, x + width, goalY, dashedPaint)
        }

        val stepX = width / (days.size - 1).coerceAtLeast(1)
        val points = days.mapIndexed { index, day ->
            val px = x + index * stepX
            val cal = day.summary?.calories ?: 0.0
            val py = chartBottom - ((cal / maxVal) * (chartBottom - chartTop)).toFloat()
            Pair(px, py)
        }

        // Draw Spline Area Gradient
        val areaPath = Path().apply {
            moveTo(points.first().first, chartBottom)
            points.forEach { lineTo(it.first, it.second) }
            lineTo(points.last().first, chartBottom)
            close()
        }
        val gradientPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = LinearGradient(
                x, chartTop, x, chartBottom,
                COLOR_ACCENT and 0x55FFFFFF,
                Color.TRANSPARENT,
                Shader.TileMode.CLAMP
            )
        }
        canvas.drawPath(areaPath, gradientPaint)

        // Draw Spline Line
        val linePath = Path().apply {
            points.forEachIndexed { i, p ->
                if (i == 0) moveTo(p.first, p.second) else lineTo(p.first, p.second)
            }
        }
        val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_ACCENT
            strokeWidth = 3f
            style = Paint.Style.STROKE
        }
        canvas.drawPath(linePath, linePaint)

        // Draw weekday labels
        val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED
            textSize = 14f
            textAlign = Paint.Align.CENTER
            typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
        }
        val dayFmt = SimpleDateFormat("EE", locale)
        days.forEachIndexed { index, day ->
            val px = x + index * stepX
            canvas.drawText(dayFmt.format(day.date).uppercase(locale), px, y + height, labelPaint)
        }
    }

    private fun calculateDetailPageHeight(payload: NutritionReportPayload): Int {
        var h = 64 + 60 + 36 // top padding + header + spacing
        if (payload.summary.hasFiber || payload.summary.hasSaturatedFat || payload.summary.hasSugars) {
            h += 130 + 36 // breakdown row + spacing
        }
        h += 40 + 50 // table header + day total
        for (meal in MealType.values()) {
            val entries = payload.entries(meal)
            if (entries.isNotEmpty()) {
                h += 60 + 26 // meal header band
                h += entries.size * 48 // item rows
                h += 24 // meal bottom spacing
            }
        }
        h += 100 // bottom padding
        return maxOf(1000, h)
    }

    private fun drawDetailPage(
        context: Context,
        canvas: Canvas,
        payload: NutritionReportPayload,
        totalHeight: Int,
        locale: Locale,
        res: Resources
    ) {
        canvas.drawColor(COLOR_PAPER)

        var curY = 64f
        val leftX = 64f
        val contentWidth = 1600f - 128f
        val nameColWidth = 840f
        val macroColWidth = contentWidth - nameColWidth

        // Header: Brand mark 56x56, "ПИТАНИЕ", Date
        drawBrandMark(context, canvas, leftX, curY, 56)

        val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_INK
            textSize = 28f
            typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        }
        canvas.drawText(res.getString(R.string.nutrition_report_nutrition_title), leftX + 76f, curY + 38f, titlePaint)

        val dateStr = formatCoverDate(payload.date, locale)
        val datePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED
            textSize = 22f
            typeface = Typeface.SERIF
            textAlign = Paint.Align.RIGHT
        }
        canvas.drawText(dateStr, leftX + contentWidth, curY + 38f, datePaint)
        curY += 80f

        // Breakdown Row (Fiber, Fat, Carbs)
        val showFiber = payload.summary.hasFiber
        val showFat = payload.summary.hasSaturatedFat
        val showCarbs = payload.summary.hasSugars

        if (showFiber || showFat || showCarbs) {
            drawBreakdownRow(canvas, leftX, curY, contentWidth, payload.summary, showFiber, showFat, showCarbs, locale, res)
            curY += 140f
        }

        // Table Header: "ПОЗИЦИЯ" | "Ж"  "У"  "Б"  "ККАЛ"
        val thLabelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED
            textSize = 14f
            letterSpacing = 0.1f
            typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        }
        canvas.drawText(res.getString(R.string.nutrition_report_table_item).uppercase(locale), leftX, curY, thLabelPaint)

        drawMacroColumnsHeader(canvas, leftX + nameColWidth, curY, macroColWidth, locale, res)
        curY += 40f

        // "Итого за день" row
        val dayTotalTitlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_INK
            textSize = 22f
            typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        }
        canvas.drawText(res.getString(R.string.nutrition_report_table_daytotal), leftX, curY, dayTotalTitlePaint)
        drawMacroColumns(canvas, leftX + nameColWidth, curY, macroColWidth, payload.summary.fat, payload.summary.carbohydrates, payload.summary.protein, payload.summary.calories, isBold = true)
        curY += 50f

        // Meal Sections
        for (meal in MealType.values()) {
            val entries = payload.entries(meal)
            if (entries.isEmpty()) continue

            val mealSummary = NutritionSummary.fromEntries(entries)

            // Meal Header Band
            val bandRect = RectF(leftX, curY - 24f, leftX + contentWidth, curY + 38f)
            val bandPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = COLOR_MEAL_BAND }
            canvas.drawRoundRect(bandRect, 12f, 12f, bandPaint)

            val mealTitlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = COLOR_INK
                textSize = 20f
                typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
            }
            val mealName = when (meal) {
                MealType.BREAKFAST -> res.getString(R.string.nutrition_meal_breakfast)
                MealType.LUNCH -> res.getString(R.string.nutrition_meal_lunch)
                MealType.DINNER -> res.getString(R.string.nutrition_meal_dinner)
                MealType.SNACK -> res.getString(R.string.nutrition_meal_snack)
            }
            canvas.drawText(mealName, leftX + 16f, curY, mealTitlePaint)

            drawMacroColumns(canvas, leftX + nameColWidth, curY, macroColWidth, mealSummary.fat, mealSummary.carbohydrates, mealSummary.protein, mealSummary.calories, isBold = true)

            // "% от дня" sub-row
            curY += 24f
            drawDayShareRow(canvas, leftX + nameColWidth, curY, macroColWidth, mealSummary, payload.summary, locale, res)
            curY += 40f

            // Food Items
            val itemNamePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = COLOR_INK
                textSize = 17f
                typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
            }
            val itemQtyPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = COLOR_MUTED
                textSize = 15f
                typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
            }

            for (entry in entries) {
                val itemSummary = NutritionSummary.fromNutrients(entry.productSnapshot.nutrients)
                val productName = entry.productSnapshot.name
                val qtyStr = formatQuantity(entry, locale)

                canvas.drawText(productName, leftX + 16f, curY, itemNamePaint)
                val nameWidth = itemNamePaint.measureText(productName)
                canvas.drawText("  $qtyStr", leftX + 16f + nameWidth, curY, itemQtyPaint)

                drawMacroColumns(canvas, leftX + nameColWidth, curY, macroColWidth, itemSummary.fat, itemSummary.carbohydrates, itemSummary.protein, itemSummary.calories, isBold = false)
                curY += 46f
            }
            curY += 20f
        }
    }

    private fun drawBreakdownRow(
        canvas: Canvas,
        x: Float,
        y: Float,
        width: Float,
        summary: com.evgarct.form.data.models.NutritionReportSummary,
        showFiber: Boolean,
        showFat: Boolean,
        showCarbs: Boolean,
        locale: Locale,
        res: Resources
    ) {
        val count = (if (showFiber) 1 else 0) + (if (showFat) 1 else 0) + (if (showCarbs) 1 else 0)
        if (count == 0) return
        val cardWidth = (width - (count - 1) * 32f) / count
        var curX = x

        if (showFiber) {
            val cardRect = RectF(curX, y, curX + cardWidth, y + 100f)
            val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = COLOR_TRACK }
            canvas.drawRoundRect(cardRect, 16f, 16f, bgPaint)

            val valPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = COLOR_INK
                textSize = 28f
                typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
            }
            val fiberStr = String.format(locale, "%.1f g", summary.fiber)
            canvas.drawText(fiberStr, curX + 24f, y + 45f, valPaint)

            val lblPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = COLOR_MUTED
                textSize = 14f
                typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
            }
            canvas.drawText(res.getString(R.string.nutrition_report_fiber), curX + 24f, y + 75f, lblPaint)
            curX += cardWidth + 32f
        }

        if (showFat) {
            drawSplitCard(
                canvas, curX, y, cardWidth,
                res.getString(R.string.nutrition_report_fat_title),
                summary.saturatedFat, res.getString(R.string.nutrition_report_fat_saturated),
                summary.unsaturatedFat, res.getString(R.string.nutrition_report_fat_unsaturated),
                locale
            )
            curX += cardWidth + 32f
        }

        if (showCarbs) {
            drawSplitCard(
                canvas, curX, y, cardWidth,
                res.getString(R.string.nutrition_report_carbs_title),
                summary.sugars, res.getString(R.string.nutrition_report_carbs_sugars),
                summary.complexCarbs, res.getString(R.string.nutrition_report_carbs_complex),
                locale
            )
        }
    }

    private fun drawSplitCard(
        canvas: Canvas,
        x: Float,
        y: Float,
        width: Float,
        title: String,
        val1: Double,
        lbl1: String,
        val2: Double,
        lbl2: String,
        locale: Locale
    ) {
        val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_INK
            textSize = 16f
            typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        }
        canvas.drawText(title, x, y + 20f, titlePaint)

        val total = maxOf(val1 + val2, 0.001)
        val barY = y + 36f
        val barH = 10f

        val ratio = (val1 / total).toFloat()
        val fill1 = width * ratio

        val barPaint1 = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = COLOR_ACCENT }
        val barPaint2 = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = COLOR_TRACK }

        canvas.drawRoundRect(RectF(x, barY, x + width, barY + barH), 5f, 5f, barPaint2)
        if (fill1 > 0) {
            canvas.drawRoundRect(RectF(x, barY, x + fill1, barY + barH), 5f, 5f, barPaint1)
        }

        val valPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_INK
            textSize = 14f
            typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        }
        val subPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED
            textSize = 12f
            typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
        }

        val row1 = String.format(locale, "%.1f g", val1)
        canvas.drawText("• $row1 $lbl1", x, y + 70f, subPaint)

        val row2 = String.format(locale, "%.1f g", val2)
        canvas.drawText("• $row2 $lbl2", x, y + 92f, subPaint)
    }

    private fun drawMacroColumnsHeader(
        canvas: Canvas,
        x: Float,
        y: Float,
        width: Float,
        locale: Locale,
        res: Resources
    ) {
        val colWidth = width / 4f
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED
            textSize = 14f
            letterSpacing = 0.08f
            textAlign = Paint.Align.RIGHT
            typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        }
        canvas.drawText(res.getString(R.string.nutrition_fat_short).uppercase(locale), x + colWidth, y, paint)
        canvas.drawText(res.getString(R.string.nutrition_carbohydrates_short).uppercase(locale), x + colWidth * 2f, y, paint)
        canvas.drawText(res.getString(R.string.nutrition_protein_short).uppercase(locale), x + colWidth * 3f, y, paint)
        canvas.drawText(res.getString(R.string.summary_calories_unit).uppercase(locale), x + colWidth * 4f, y, paint)
    }

    private fun drawMacroColumns(
        canvas: Canvas,
        x: Float,
        y: Float,
        width: Float,
        fat: Double,
        carbs: Double,
        protein: Double,
        calories: Double,
        isBold: Boolean
    ) {
        val colWidth = width / 4f
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_INK
            textSize = if (isBold) 20f else 17f
            textAlign = Paint.Align.RIGHT
            typeface = if (isBold) Typeface.create(Typeface.MONOSPACE, Typeface.BOLD) else Typeface.MONOSPACE
        }
        canvas.drawText(String.format(Locale.US, "%.0f", fat), x + colWidth, y, paint)
        canvas.drawText(String.format(Locale.US, "%.0f", carbs), x + colWidth * 2f, y, paint)
        canvas.drawText(String.format(Locale.US, "%.0f", protein), x + colWidth * 3f, y, paint)
        canvas.drawText(String.format(Locale.US, "%.0f", calories), x + colWidth * 4f, y, paint)
    }

    private fun drawDayShareRow(
        canvas: Canvas,
        x: Float,
        y: Float,
        width: Float,
        meal: NutritionSummary,
        day: com.evgarct.form.data.models.NutritionReportSummary,
        locale: Locale,
        res: Resources
    ) {
        val colWidth = width / 4f
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_MUTED
            textSize = 12f
            textAlign = Paint.Align.RIGHT
            typeface = Typeface.create(Typeface.MONOSPACE, Typeface.NORMAL)
        }
        val ofDay = " " + res.getString(R.string.nutrition_report_table_ofday)
        fun share(v: Double, t: Double): String =
            if (t > 0) String.format(locale, "%.0f%%%s", (v / t) * 100, ofDay) else "—"

        canvas.drawText(share(meal.fat, day.fat), x + colWidth, y, paint)
        canvas.drawText(share(meal.carbohydrates, day.carbohydrates), x + colWidth * 2f, y, paint)
        canvas.drawText(share(meal.protein, day.protein), x + colWidth * 3f, y, paint)
        canvas.drawText(share(meal.calories, day.calories), x + colWidth * 4f, y, paint)
    }

    private fun formatQuantity(entry: FoodEntry, locale: Locale): String {
        return when (val q = entry.quantity) {
            is FoodQuantity.Grams -> "${q.amount.toInt()} g"
            is FoodQuantity.Milliliters -> "${q.amount.toInt()} ml"
            is FoodQuantity.Pieces -> "${q.amount.toInt()} ${q.size}"
            is FoodQuantity.Serving -> "${q.amount.toInt()} serv"
            is FoodQuantity.AsConsumed -> q.label
        }
    }

    private fun drawBrandMark(context: Context, canvas: Canvas, x: Float, y: Float, size: Int) {
        val drawable = ContextCompat.getDrawable(context, R.drawable.ic_trace_primary) ?: return
        drawable.setBounds(x.toInt(), y.toInt(), x.toInt() + size, y.toInt() + size)
        drawable.draw(canvas)
    }

    private fun formatCoverDate(date: Date, locale: Locale): String {
        val fmt = SimpleDateFormat("EEEE, d MMMM yyyy", locale)
        return fmt.format(date)
    }

    private fun getLocalizedResources(context: Context, locale: Locale): Resources {
        val config = Configuration(context.resources.configuration).apply {
            setLocale(locale)
        }
        return context.createConfigurationContext(config).resources
    }
}
