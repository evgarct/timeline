# Today

## Purpose

Today opens with the latest body photo, then progressively reveals current context. It is a single vertical document rather than a dashboard.

## Data flow

After session restoration, the app loads `/api/events` and a HealthKit activity snapshot concurrently. The snapshot contains daily step totals for the current Monday-to-Sunday week plus today's walking/running distance. The newest `progress_photo` session supplies the hero pager; the newest `measurements` event supplies body values.

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
- The average includes every elapsed calendar day from Monday through today, including an elapsed day with zero recorded steps. Future days are excluded.
- HealthKit remains the source of truth. The snapshot is held locally in app memory and is not written to Neon or represented as Timeline events.
- The detail screen shows today's steps, goal progress, the weekly average as a number, the seven-day chart, and today's walking/running distance when available.
- Sharing renders a clean 1080 × 1350 branded image and presents the native iOS share sheet for Telegram or any other installed destination. Progress photos and application chrome are excluded.
