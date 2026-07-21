# Today

## Purpose

Today opens with the latest body photo, then progressively reveals current context. It is a single vertical document rather than a dashboard.

## Data flow

After session restoration, the app loads `/api/events` and today's HealthKit step count concurrently. The newest `progress_photo` session supplies the hero pager; the newest `measurements` event supplies body values.

## States

- Signed out: email OTP flow.
- Loading: quiet progress indicator over the photo surface.
- No photo: private empty state directing the user to existing web/MCP capture.
- Loaded: swipeable photo session, gallery, steps, and measurements.
- Network failure: retain any visible data and show a restrained error below.
- HealthKit unavailable: show no fabricated value and keep the rest usable.

Compare and share controls remain visible for spatial continuity but explain that the feature is not yet available.

## First viewport contract

On iPhone 15 Pro, the photo and its controls form the complete initial viewport. The compact nutrition/activity summary sits immediately above the system tab bar. Timeline details remain fully below that viewport and become visible only after scrolling. UI tests protect this boundary, while private visual QA uses real portrait media from the dedicated test account without adding it to the repository.

The photo itself stays fixed while the foreground document scrolls. Activity starts at 12,000 steps until the user taps the full right-hand summary area, which replaces it with the current HealthKit total. A long press opens a native numeric dialog; the chosen daily goal persists locally and drives the goal label, progress bar, and percentage.
