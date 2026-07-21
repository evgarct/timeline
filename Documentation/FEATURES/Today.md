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
