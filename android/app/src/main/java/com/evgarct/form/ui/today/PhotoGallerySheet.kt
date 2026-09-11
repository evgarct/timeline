package com.evgarct.form.ui.today

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.outlined.PushPin
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.evgarct.form.FormApp
import com.evgarct.form.core.theme.LightInk
import com.evgarct.form.core.theme.Trace
import com.evgarct.form.data.models.PhotoItem

@Composable
fun PhotoGallerySheet(
    eventId: String,
    photos: List<PhotoItem>,
    initialIndex: Int = 0,
    canPinCover: Boolean = true,
    onDismiss: () -> Unit
) {
    val prefs = FormApp.instance.appPreferences
    val currentPinnedId = prefs.getCoverPhotoId(eventId)
    val pagerState = rememberPagerState(initialPage = initialIndex, pageCount = { photos.size })

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        if (photos.isNotEmpty()) {
            HorizontalPager(
                state = pagerState,
                modifier = Modifier.fillMaxSize()
            ) { page ->
                val photo = photos[page]
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(36.dp),
                        color = Trace,
                        strokeWidth = 2.dp
                    )
                    AsyncImage(
                        model = photo.url ?: photo.thumbnailUrl,
                        contentDescription = photo.alt,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Fit
                    )
                }
            }
        }

        // Top Toolbar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 48.dp, start = 16.dp, end = 16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (photos.size > 1) {
                Text(
                    text = "${pagerState.currentPage + 1} / ${photos.size}",
                    color = LightInk.copy(alpha = 0.8f),
                    fontSize = 14.sp
                )
            }

            Spacer(modifier = Modifier.weight(1f))

            if (canPinCover && photos.size > 1) {
                val currentPhoto = photos.getOrNull(pagerState.currentPage)
                val isPinned = currentPhoto?.id == currentPinnedId
                IconButton(
                    onClick = {
                        currentPhoto?.let { prefs.setCoverPhotoId(eventId, it.id) }
                    }
                ) {
                    Icon(
                        imageVector = if (isPinned) Icons.Filled.PushPin else Icons.Outlined.PushPin,
                        contentDescription = "Set Cover",
                        tint = if (isPinned) Trace else LightInk
                    )
                }
            }

            IconButton(onClick = onDismiss) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Close",
                    tint = LightInk
                )
            }
        }
    }
}
