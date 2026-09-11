package com.evgarct.form.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evgarct.form.core.theme.Ink
import com.evgarct.form.core.theme.LightInk
import com.evgarct.form.core.theme.SurfaceCard
import com.evgarct.form.core.theme.SurfaceCardBorder
import com.evgarct.form.core.theme.TextMuted
import com.evgarct.form.core.theme.TextSecondary
import com.evgarct.form.core.theme.Trace

@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(16.dp),
    backgroundColor: Color = SurfaceCard.copy(alpha = 0.85f),
    borderColor: Color = SurfaceCardBorder,
    onClick: (() -> Unit)? = null,
    content: @Composable () -> Unit
) {
    val clickableModifier = if (onClick != null) {
        modifier
            .clip(shape)
            .clickable(onClick = onClick)
    } else {
        modifier.clip(shape)
    }

    Surface(
        modifier = clickableModifier.border(1.dp, borderColor, shape),
        shape = shape,
        color = backgroundColor
    ) {
        content()
    }
}

@Composable
fun SerifNumber(
    value: String,
    modifier: Modifier = Modifier,
    unit: String? = null,
    color: Color = LightInk,
    fontSize: Int = 32
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.Bottom
    ) {
        Text(
            text = value,
            fontFamily = FontFamily.Serif,
            fontWeight = FontWeight.Normal,
            fontSize = fontSize.sp,
            color = color
        )
        if (unit != null) {
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = unit,
                fontFamily = FontFamily.Default,
                fontWeight = FontWeight.Normal,
                fontSize = (fontSize * 0.45).sp,
                color = TextSecondary,
                modifier = Modifier.padding(bottom = (fontSize * 0.1).dp)
            )
        }
    }
}

@Composable
fun SectionEyebrow(
    text: String,
    modifier: Modifier = Modifier
) {
    Text(
        text = text.uppercase(),
        style = MaterialTheme.typography.labelMedium,
        color = Trace,
        modifier = modifier
    )
}

@Composable
fun LoadingSpinner(
    modifier: Modifier = Modifier,
    size: Dp = 32.dp,
    color: Color = Trace
) {
    Box(
        modifier = modifier,
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator(
            modifier = Modifier.size(size),
            color = color,
            strokeWidth = 2.5.dp
        )
    }
}

@Composable
fun LinearProgressBar(
    progress: Float,
    modifier: Modifier = Modifier,
    color: Color = Trace,
    backgroundColor: Color = SurfaceCardBorder,
    height: Dp = 4.dp
) {
    val clampedProgress = progress.coerceIn(0f, 1f)
    Box(
        modifier = modifier
            .height(height)
            .fillMaxWidth()
            .clip(RoundedCornerShape(height / 2))
            .background(backgroundColor)
    ) {
        Box(
            modifier = Modifier
                .height(height)
                .fillMaxWidth(clampedProgress)
                .clip(RoundedCornerShape(height / 2))
                .background(color)
        )
    }
}
