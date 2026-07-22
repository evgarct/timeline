# Today

## Purpose

Today opens with the latest body photo, then progressively reveals current context. It is a single vertical document rather than a dashboard.

## Data flow

After session restoration, the app loads `/api/events` and today's HealthKit activity snapshot concurrently. A snapshot contains daily step totals for the selected Monday-to-Sunday week plus the selected day's walking/running distance. The newest `progress_photo` session supplies the hero pager; the newest `measurements` event supplies body values.

## States

- Signed out: email OTP flow.
- Loading: quiet progress indicator over the photo surface.
- No photo: private empty state directing the user to existing web/MCP capture.
- Loaded: swipeable photo session, gallery, steps, and measurements.
- Network failure: retain any visible data and show a restrained error below.
- HealthKit unavailable: show no fabricated value and keep the rest usable.

Compare remains visible for spatial continuity but explains that the feature is not yet available. Activity sharing is available from the long-press menu and from the detail screen.

## First viewport contract

On iPhone 15 Pro, the photo and its controls form the complete initial viewport. The compact nutrition/activity summary sits immediately above the system tab bar. Timeline details remain fully below that viewport and become visible only after scrolling. UI tests protect this boundary, while private visual QA uses real portrait media from the dedicated test account without adding it to the repository.

The photo itself stays fixed while the foreground document scrolls. Activity requests HealthKit access and refreshes automatically on first appearance and whenever the app becomes active; no placeholder step value is fabricated. Tap refreshes manually. A long press opens a native menu with exactly three actions: set a locally persisted daily goal, open the full-screen detail, and share a generated branded image.

## Weekly activity contract

- The week is Monday through Sunday in the user's calendar and locale.
- The detail screen can move to any past date with one-day arrows or a native calendar. Future dates are unavailable, and returning to today disables the forward arrow.
- In the current week, the average includes Monday through the selected day. In a completed week, it includes all seven days regardless of which day is selected. Days without samples count as zero; days after the selection in an unfinished week are absent from the graph.
- HealthKit remains the source of truth. The snapshot is held locally in app memory and is not written to Neon or represented as Timeline events.
- The detail screen shows selected-day steps, current locally stored goal progress, the weekly average as a number, the seven-day chart, and selected-day walking/running distance when available.
- Sharing renders a clean 1080 × 1350 branded image in the screen's active color scheme and presents the native iOS share sheet for Telegram or any other installed destination. Progress photos, slogans, and application chrome are excluded.
