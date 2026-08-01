# Timeline

## Purpose

Timeline is the body archive: photographs, measurements, and InBody records in one quiet chronology. It describes change without goals, ratings, streaks, or motivational language.

## Measurements

The native editor creates a `measurements` Timeline event for a selected date. Every field is optional, but at least one value is required. The personal workflow uses weight, chest, waist, abdomen, relaxed and flexed arm, forearm, hips, thigh, and calf. A single arm/leg value is persisted to both existing left/right schema fields; the archive presents one value while both sides match.

The editor shows the last recorded value as context and accepts decimal comma or point. Saving uses the authenticated `/api/events` endpoint and immediately inserts the returned event into the local chronology.

## Visual contract

- warm, near-black photo-derived background;
- large editorial headline and latest weight, followed by the archive;
- one glass surface per meaningful record, with measurement rows inside rather than nested cards;
- one neutral add action; no charts, score colors, goals, or gamification;
- RU, EN, and CS strings for every visible label.

