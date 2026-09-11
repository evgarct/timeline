# Form — Android Port Functional Spec

**Purpose:** a complete, implementation-ready functional inventory of the existing native iOS app (`Form/`, SwiftUI, bundle `com.evgarct.form`), written so an equivalent native Android app (target device: Pixel 11 Pro XL) can be built without needing to read the Swift source. The shared backend (`src/app/api/**`, Next.js + Neon Postgres + Neon Auth + Cloudflare R2) is **not** being rewritten — the Android app is a new client of the same REST API the iOS app already uses.

Source of truth for this document: `Form/`, `FormTests/`, `FormUITests/`, and `src/app/api/**` / `src/domain/**` in this repo, as of 2026-09-11.

---

## 1. Overview & architecture

- **Client:** native SwiftUI app, iOS 26+, Swift 6 strict concurrency, generated via XcodeGen (`project.yml`, no committed `.xcodeproj`). Dark-themed by default (`.preferredColorScheme(.dark)` at the root; report/export screens force light).
- **Backend:** Next.js app in the same repo (`src/app/api/**`), Neon Postgres for data, Neon Auth (better-auth-based) for authentication, Cloudflare R2 for object storage (progress photos, InBody originals, nutrition PDF reports). This backend also serves a web app and an MCP (AI agent) surface — same repository functions, different auth path.
- **Auth mechanism: cookie session, not bearer tokens.** The client calls Neon Auth's email-OTP endpoints; on success the server sets an HTTP-only session cookie, and every subsequent API call rides that cookie via a shared cookie jar (`URLSession` + `HTTPCookieStorage` on iOS). **This is the single most important thing to replicate correctly on Android** — use `CookieManager`/`OkHttp CookieJar` with a persistent cookie store, not a token stored in headers, or the existing backend auth won't work unmodified.
- **No local database on iOS** — no SwiftData/CoreData. Local persistence is limited to `UserDefaults`-equivalent key/value storage: cover-photo pin per event, app language, report language, step goal, nutrition goals (JSON-encoded). Everything else is fetched live from the API on each screen load / pull-to-refresh.
- All data — timeline events, nutrition entries/products, measurements — is owner-scoped server-side; every authenticated route 401s without a valid session.

---

## 2. Navigation map

```
AuthenticationView (signed out)
        │  email OTP → code OTP → signed in
        ▼
RootView → TabView (3 tabs)
        ├── Today            (default landing tab)
        │     ├─ Settings (sheet, via "⋯" button)
        │     ├─ PhotoGalleryView (full-screen sheet, from "All Photos" / hero tap)
        │     └─ ActivityDetailView (full-screen cover, from activity metric long-press)
        ├── Nutrition
        │     ├─ Calendar (sheet, date picker)
        │     ├─ ProductSearchSheet (add to meal) → BarcodeScannerView (full-screen) / QuantityEditor (sheet)
        │     ├─ FoodEntryEditor (sheet, edit logged entry)
        │     ├─ NutritionGoalsEditor (sheet)
        │     ├─ NutrientDetailsView (sheet, "All nutrients")
        │     └─ NutritionReportShareSheet (system share sheet, PDF export)
        └── Timeline
              ├─ MeasurementEditor (sheet, "+" button)
              └─ PhotoGalleryView (sheet, reused, read-only here)
```

- Tabs: **Today** (house icon), **Nutrition** (fork.knife icon), **Timeline** (chart.bar icon). Tab bar minimizes on scroll-down.
- **There is no separate "History" tab** in the shipped app, despite older product docs mentioning one as a coming-soon placeholder — do not build one unless the user wants new scope.
- **Settings is not a tab** — it's a sheet opened from the "⋯" button on the Today screen's header only.

---

## 3. Screens — detailed spec

### 3.1 Authentication
- Two-stage email OTP flow: **email entry → code entry**. No password option, no OAuth/social login, no "resend code" timer UI.
- Stage 1: email text field (email keyboard type, no autocap/autocorrect). "Send" button — disabled while loading or field empty. Client validates the string contains `@` before submitting.
- Stage 2: numeric code field (monospaced, OTP content type). "Verify" button, same disabled logic. Client requires code length ≥ 4. A "Change email" link resets to stage 1.
- Inline red error text below the active field on failure.
- Error mapping: invalid email / invalid code format → local validation errors; server 400/401 → "rejected" (wrong code); any other non-2xx → "service unavailable".
- On verified success: app transitions to signed-in state and loads Today.

**Backend calls** (see §6 for full request/response shapes):
- `POST /api/auth/email-otp/send-verification-otp` `{email, type: "sign-in"}`
- `POST /api/auth/sign-in/email-otp` `{email, otp}`, followed by a session confirmation check
- `GET /api/auth/get-session` (used both to confirm sign-in and to restore session on app launch)
- `POST /api/auth/sign-out`

### 3.2 Today (default tab)
A single scrolling document: photo hero at top, timeline archive beneath it (not two separate screens).

**Hero section:**
- Full-bleed photo background (blurred/dimmed via gradient fade top & bottom) behind the content, non-interactive.
- Horizontally paged photo carousel (swipe left/right) if the latest progress-photo event has multiple photos; empty-state placeholder (gradient + icon) if no photos yet; loading spinner while fetching.
- Header row: "TODAY" eyebrow label + large serif-style date (from the latest photo's date, else current date) + "⋯" button opening Settings.
- Photo action row: page indicator ("n / total") when multiple photos; "Compare" button (**currently a stub** — shows a "coming soon" message, no comparison feature exists yet); "All Photos" button opens the full gallery (disabled if no photos).
- **Summary capsule** with two columns, side by side:
  - **Nutrition column:** today's total calories + a "protein g / fat g / carbs g" macro line underneath.
  - **Activity column:** selected-day step count, a "Goal: n" target line, a horizontal progress bar (steps ÷ goal, clamped at 100%), a percent-of-goal caption (or a denied/unavailable caption if HealthKit access isn't granted), and a refresh icon that spins while refreshing. Tap refreshes; long-press opens a context menu with:
    - **Set goal** — alert with a numeric input, valid range 1–100,000, persisted locally.
    - **Detail** — opens the full Activity Detail screen.
    - **Share** — renders a shareable image card and opens the system share sheet.
- Horizontal swipe gesture on the hero (min drag distance ~24pt) also switches photos.

**Timeline section** (embedded, no header repetition beyond "ARCHIVE" eyebrow + "Timeline" title):
- Same shared timeline-archive component used by the standalone Timeline tab (§3.6), but **excludes** the specific photo event already shown in the hero above (to avoid showing it twice).
- Shows an inline network-error message if the last refresh failed.

**Behavior:** pull-to-refresh reloads timeline events, activity data, and nutrition summary concurrently. On appear, refreshes activity + nutrition, and loads the timeline if it hasn't been loaded yet. Re-refreshes activity when the app returns to foreground.

**Cover-photo pinning:** when a progress-photo event has multiple photos, the user can pin one specific photo (from the gallery sheet) to always be the one shown in the Today hero for that event, even across app relaunches. This preference is **stored only on-device** (no backend field for it) — keyed by event ID → chosen photo ID.

### 3.3 Activity Detail (full-screen modal from Today)
- Toolbar: brand mark, share button (disabled until data loaded), close button.
- Date navigation: previous-day button, a button that opens a calendar date picker (capped so you can't pick a future date), next-day button (disabled once you're on today).
- Body:
  - Large serif step count with a walking-figure icon.
  - Goal progress: goal number, percentage, capsule progress bar.
  - **Weekly section:** 7-day rolling average figure + a week chart (Mon–Sun bar/area/line combo) that highlights the selected day and shows a dashed rule at the weekly average.
  - Optional walking/running distance row for the selected day (if HealthKit distance data exists).
- Loading state: content shown "redacted"/skeleton style at reduced opacity. Failure state: retry button.
- **Share:** renders a fixed-aspect (1080×1350) share card image — brand mark, date, the same activity visuals — and opens the system share sheet with that image.

### 3.4 Photo Gallery (full-screen sheet)
- Horizontally paged full-screen photo viewer (swipe between photos), black background, scale-to-fit.
- Per-photo loading spinner / failure placeholder.
- Toolbar: "Set cover" pin button (only present when reached from Today and there's more than one photo; shows filled/disabled once the current photo is already the pinned cover) + "Done" button.
- When reached from the Timeline archive's photo cards, it's **read-only** (no pin button).

### 3.5 Nutrition (tab)
The largest, most feature-dense screen.

- **Header:** day navigation (previous/next day arrows + a tappable date label that opens a calendar sheet), plus an "export" button that renders and shares a PDF nutrition report for the selected day (spinner while exporting; disabled with no entries or mid-export).
- **Day summary:** four macro columns (Fat / Carbs / Protein / kcal, kcal emphasized) totaled for the whole day, with a small "target" icon that opens the Goals editor. If any goal is set, an additional row shows each macro's percent-of-goal.
- **Meal sections** — one per `MealType` (**Breakfast, Lunch, Dinner, Snack**, in that fixed order), each collapsible:
  - Header: icon + name (tap to collapse/expand), a **repeat** button (copies the *previous day's* entries for that meal into the selected day — additive only, never overwrites/duplicates existing entries; spinner while running; shows an error/empty message if there was nothing to copy), and an **add** button (`+`) opening the product-search sheet.
  - If non-empty: a meal subtotal (macro columns) row.
  - Each logged item: name, quantity caption, macro breakdown — tapping opens the entry editor. Empty-state text when expanded and empty.
- **"All nutrients" row** at the bottom opens a full nutrient breakdown for the whole day.
- Pull-to-refresh reloads the selected day. Save errors surface as an alert.

**Add-to-meal flow (ProductSearchSheet):**
- Searchable product list with a debounced (300ms) text search and a barcode-scan button in the toolbar.
- When search is empty: two paginated sections — "Recently in this meal" (products previously logged for *this specific* meal type) then "More products" (recently used elsewhere, excluding ones already shown above), page size 20, with "show more" pagination.
- Scanning or typing an exact barcode match auto-opens that product's quantity editor.
- Tapping any product opens the **QuantityEditor**.

**QuantityEditor:**
- Shows product name/brand, and a *live-recomputing* macro preview as the entered quantity changes.
- "Quick select" chips: the default 100 g/ml reference, any alternate stated bases (e.g. "per portion (330 ml)"), deduplicated serving sizes, and piece sizes (e.g. "1 slice") each converted to computed grams.
- Either a free-form numeric amount field, or (for piece/serving selections) a count stepper showing the computed gram equivalent.
- "All nutrients" link to the full nutrient list for that product/quantity.
- Save disabled while amount ≤ 0 or while saving.

**FoodEntryEditor** (edit an already-logged entry):
- Meal-type picker (segmented control), quantity field, date picker (date only, no time), "All nutrients" link, and a destructive **Delete** button with a confirmation dialog.

**NutritionGoalsEditor:** four optional numeric fields — calories, protein, fat, carbs — persisted locally (JSON-encoded key/value, not synced to the backend).

**NutrientDetailsView:** a grouped list of *every* nutrient for the day (or for one product/entry, depending on entry point), deduplicated and summed by nutrient key+unit, grouped in this fixed section order: **Macros → Fats → Carbohydrates → Salt → Vitamins → Minerals → Other**. Each row shows the label, a provenance caption ("Estimated" / "Calculated" / nothing for directly-stated values), and the value with a qualifier prefix when applicable (`<`, `≈`, or literal "trace").

**BarcodeScannerView:** full-screen camera view, barcode recognition only (no other scan types), with a fallback "not supported on this device" state. Fires once on the first recognized barcode, then stops.

### 3.6 Timeline (tab)
Full-screen version of the same archive embedded in Today — **must render identically** (same component/logic), just without the photo hero.

- Header: "ARCHIVE" eyebrow + "Timeline" title, a "+" button opening the measurement editor. If the latest measurement event includes weight, shows a large weight figure + a delta arrow/label vs. the previous measurement.
- Loading spinner on first load; a full-screen error state with retry if the network fails and there's no cached data; otherwise the archive.

**Archive rendering rules** (grouped by calendar day, newest day first, newest event first within a day):
- **Progress-photo events** → a tall photo card (title "Photo session", date, photo-count badge) — tapping opens the read-only Photo Gallery.
- **Measurement events** → a card with the weight headline + delta, and a grid of every other populated measurement (chest, waist, abdomen, arm — relaxed & flexed, forearm, hips, thigh, calf), each showing its own delta vs. the previous measurement event. Note: the backend stores separate left/right values for bicep/thigh/calf/neck, but **the app currently shows only one shared "arm"/"thigh"/"calf" figure** (left-side values), entered as one combined field in the editor — decide deliberately whether to keep this simplification or expose left/right separately on Android.
- **InBody events** → shown only as a generic row (icon + "InBody" + time) — **no metrics are displayed**, even though the backend stores rich InBody data (see §8). This is a genuine gap in the iOS app, not an intentional simplification — worth deciding whether to fix it in the Android version.
- **Workout events and nutrition-log events do not appear in this archive at all** — workouts only ever surface inside the Activity Detail screen (from HealthKit, not from a Timeline event), and nutrition entries only live in the Nutrition tab.
- Empty state: a simple "no events yet" message.

**Measurement Editor (add measurements, "+"):**
- Custom compact top bar (Cancel/Save), a date picker (date only), then 10 numeric fields: weight (kg) + 9 circumference measurements (cm) — chest, waist, abdomen, neck, hips, forearm, bicep (relaxed), bicep (flexed), thigh, calf. Each field shows the previous recorded value as a caption for reference.
- Save is disabled until at least one field has a value. On save, the new event is posted and the local list is updated immediately (optimistic-ish: appended + resorted).

### 3.7 Settings (sheet, not a tab)
Reached only via the "⋯" button on Today.
- **Language section:** two independent pickers — "App language" (drives the whole UI's locale) and "Report language" (used only when generating the PDF nutrition report) — each over English / Russian / Czech.
- **About section:** static app name + version number.
- **Sign Out** button (destructive styling), signs out and dismisses back to the Authentication screen.
- **Not present:** no account deletion, no HealthKit permission re-request UI, no storage-usage display, no notification settings, no data export beyond the nutrition PDF.

---

## 4. Domain model reference

Field lists below are platform-neutral (type, not Swift-specific). All dates are ISO-8601 with fractional seconds where noted.

### TimelineEvent (discriminated by `type`)
Common base fields on every event: `id: string`, `occurredAt: datetime`, `timezone: string`, `note: string | null`.

- **`progress_photo`** → `photos: [{ id, assetId?, url?, thumbnailUrl?, width?, height?, alt }]`
- **`measurements`** → all fields optional numbers (cm unless noted): `weightKg, waistCm, abdomenCm, chestCm, neckCm, hipsCm, forearmCm, leftBicepCm, rightBicepCm, leftBicepFlexedCm, rightBicepFlexedCm, leftThighCm, rightThighCm, leftCalfCm, rightCalfCm`
- **`workout`** → `completed: bool, muscleGroups: [string]` (not shown as a Timeline row on iOS — HealthKit is the actual source of workout display data)
- **`inbody`** → on iOS, no fields beyond the base event are decoded/shown. The backend's actual schema is richer (see §8).
- **`nutrition_entry`** → carries a `FoodEntryPayload` (see below) — filtered out of the visible archive on iOS.
- **`unsupported`** (client-side catch-all) → any event `type` the client doesn't recognize is preserved with just its base fields + the raw type string, so older app versions don't crash on new server event types. **Recommend the Android client implement the same forward-compatibility pattern.**

`MeasurementDelta`: `current: number, previous: number?`, with a computed change and a increased/decreased/unchanged direction (±0.005 dead-zone to avoid noise).

### Nutrition domain
- `NutrientValue`: `key?: string, label: string, value?: number, unit: string, qualifier?: string, originalText?: string, dailyValuePercent?: number, provenance: "stated" | "calculated" | "estimated"`
- `NutrientBase`: `id, label, amount: number, unit: string, nutrients: NutrientValue[]` — a stated reference amount (e.g. "per 100g" or "per portion (330ml)")
- `PieceSizeOption`: `size: string, grams: number, provenance`
- `ServingSizeOption`: `label: string, amount: number, provenance`
- `LocalizedText`: `{ en?, ru?, cs? }` with locale-fallback resolution
- `NutritionProduct`: `id, name, brand?, barcode?, baseUnit: "g"|"ml", nutrientBases: NutrientBase[], pieceSizes: PieceSizeOption[], servingSizes: ServingSizeOption[], type?: LocalizedText, genericName?: LocalizedText, createdAt, updatedAt`
- `FoodQuantity` (discriminated by `unit`): `grams(number)` | `milliliters(number)` | `pieces(number, size: string)` | `serving(number, label?, servingSizeId?)` | `as_consumed(label: string)` (amount fixed at 1, for free-text ad-hoc entries with no product match)
- `MealType`: `breakfast | lunch | dinner | snack`
- `FoodProductSnapshot`: `name, brand?, nutrients: NutrientValue[], type?, genericName?, baseAmount?` — a **full point-in-time copy** of the product's nutrition data taken when the entry was logged, so later edits to the product catalog never retroactively change historical entries
- `FoodEntry`: `id, type, occurredAt, timezone, note?, productId?, mealType, quantity, productSnapshot`
- `NutritionSummary`: `{ calories, protein, fat, carbohydrates }` (defaults 0), summed from nutrient keys `energy_kcal/protein/fat/carbohydrates`
- `NutritionGoals`: `{ calories?, protein?, fat?, carbohydrates? }` — **local-only**, not synced to the backend
- `GoalStatus`: `onTarget | under(amount) | over(amount)`, using a ±10% "on target" band

---

## 5. State / data-flow model (for reference when structuring the Android app's ViewModels/repositories)

- **App-level session state machine:** `restoring → signedOut | signedIn | unavailable(reason)`. On launch: check for an existing session; if present, concurrently load Today + Nutrition. On sign-out: clear all in-memory state.
- **Today screen state:** idle/loading/loaded/failed, holding the full events list, an activity-snapshot state (idle/value/denied/unavailable — mirroring step-permission states), and in-flight flags for activity refresh and measurement save.
- **Nutrition screen state:** entries for the selected day, product search results + separate paginated "recent for this meal" and "discover" lists (with their own page counters / hasMore flags), a per-day summary, the selected date, a per-meal-type "is repeating" set (so one meal's repeat action doesn't block others), and an export-in-progress flag.
- Both screens map a 401/unauthorized API response to a distinct "session expired" message (vs. a generic "network error" for everything else) so the UI can prompt re-login appropriately.
- Selected-day nutrition and activity both re-derive from a "current day" selector — build this as a shared date-selection concept if convenient, though iOS keeps them independent per-screen.

---

## 6. Backend API reference (unchanged — Android calls these directly)

Base URLs are read from app configuration (iOS reads `FormAuthBaseURL` / `FormAPIBaseURL` from build config). All routes below except the auth and MCP/cron ones require a valid session cookie; a missing/invalid session returns `401 {"error": "unauthorized"}`. All data is scoped to the authenticated user.

### Auth (Neon Auth / better-auth, proxied under `/api/auth/*`)
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/email-otp/send-verification-otp` | `{ email, type: "sign-in" }` | sends the OTP email |
| POST | `/api/auth/sign-in/email-otp` | `{ email, otp }` | sets session cookie on success |
| GET | `/api/auth/get-session` | — | 401 or literal `"null"` body = signed out; otherwise signed in |
| POST | `/api/auth/sign-out` | — | clears session |

### Timeline events
| Method | Path | Body / Query | Notes |
|---|---|---|---|
| GET | `/api/events` | — | all timeline events for the user |
| POST | `/api/events` | discriminated-union event payload (`type` = `progress_photo\|workout\|measurements\|inbody\|nutrition_entry`) | create |
| GET | `/api/events/{id}` | — | fetch one |
| PUT | `/api/events/{id}` | same shape as POST | update |
| DELETE | `/api/events/{id}` | — | 204 on success |

Measurement creation payload example (matches what iOS sends): `{ id: <uuid>, type: "measurements", occurredAt: <ISO-8601 w/ fractional seconds>, timezone, values: {...BodyMeasurements fields} }`.

### Nutrition
| Method | Path | Body / Query | Notes |
|---|---|---|---|
| GET | `/api/nutrition/entries` | `?date=YYYY-MM-DD&timezone=...` | day's food entries |
| POST | `/api/nutrition/entries` | `{ productId? \| product?, mealType, quantity, occurredAt, timezone, note?, idempotencyKey: <uuid> }` | exactly one of `productId`/`product` required; `idempotencyKey` guards duplicate submits on retry |
| GET/PUT/DELETE | `/api/nutrition/entries/{id}` | PUT body: `{ mealType, quantity, occurredAt, timezone }` | |
| POST | `/api/nutrition/entries/repeat` | `{ mealType, sourceDate: YYYY-MM-DD, targetDate: YYYY-MM-DD, timezone }` | additive copy, one meal at a time |
| GET | `/api/nutrition/products` | `?query=&page=&pageSize=` (max 100) | search/browse catalog |
| POST | `/api/nutrition/products` | product definition | upsert a product |
| GET | `/api/nutrition/products/{id}` | — | |
| GET | `/api/nutrition/products/recent` | `?mealType=&page=&pageSize=` (max 50) | most recently logged, per meal type |
| GET | `/api/nutrition/nutrients` | `?productId=... \| entryId=... \| date=&timezone=` | nutrient lookup by product, by entry, or aggregated per day |
| POST | `/api/nutrition/reports` | multipart: `reportDate` (YYYY-MM-DD), `timezone`, file `pdf` (application/pdf), file `ogImage` (image/jpeg) | requires R2 configured; enforces a max size per file; returns `{ reportId, shareUrl }` — `shareUrl` is a public, ~10-day-expiring landing page link |
| GET | `/api/nutrition/reports/{id}/pdf` | — | serves the stored PDF (web-side consumption; Android already has its own rendered bytes so doesn't need to call this) |
| GET | `/api/nutrition/reports/{id}/og-image` | — | serves the stored OG preview image |

### Media (progress photos / InBody originals)
Not called by the current iOS app at all — photo/InBody capture-and-upload is only implemented on the web app today. Documented here in case the Android app is the one to finally implement native capture:
| Method | Path | Notes |
|---|---|---|
| GET | `/api/media/{id}` | authenticated streamed download, InBody-only, `status=ready` only |
| POST | `/api/uploads/presign` | creates a pending media row, returns presigned PUT URLs (progress photos: `full`+`thumbnail` JPEG; InBody: one `original` upload, pdf/heic/heif/jpeg/png); enforces a per-user storage quota; 503 if R2 not configured |
| POST | `/api/uploads/complete` | verifies the uploaded object(s) (size/type/magic-byte check) before marking the asset ready |
| POST/GET | `/api/uploads/cleanup` | cron-only, bearer-secret protected — not relevant to a client app |

### MCP / AI-agent surface (not used by the mobile client, informational only)
`/api/mcp`, `/api/mcp/oauth/*`, `/api/mcp/tokens` — a separate OAuth-authenticated surface used by AI agents, backed by the same repository functions as the REST API above.

---

## 7. Native platform capabilities → Android equivalents

| iOS capability | Used for | Android equivalent to evaluate |
|---|---|---|
| HealthKit (read-only: step count, walking/running distance, workouts incl. type/duration/energy) | Today activity summary, Activity Detail screen, weekly chart | **Health Connect API** (Google's on-device health data store) — closest direct analog; requires runtime permission + the Health Connect app/OS component present (standard on modern Pixels). No background delivery is used on iOS, so a simple on-demand read is sufficient — no need for Health Connect background sync initially. |
| VisionKit `DataScannerViewController` (barcode only) | Add-to-meal barcode scan | **CameraX + ML Kit Barcode Scanning API** (or ZXing) — ML Kit is the closer analog (on-device, no network) |
| PDFKit (renders 2 pages, combines into one PDF) | Nutrition report export | Android `PdfDocument` (draw each page via `Canvas`) or a small PDF library if custom typography/layout gets complex |
| Swift Charts (weekly step chart, weekly calorie chart — area+line+point, dashed average rule) | Activity Detail, Nutrition report | **Compose-native charting** — Vico or a hand-rolled Canvas chart; no first-party Jetpack chart library yet |
| `UIActivityViewController` (share sheet) | Activity share image, nutrition report link | Android's `Intent.ACTION_SEND` share sheet |
| `AsyncImage` (remote image loading) | All photo display | **Coil** (standard Compose image-loading library) |
| Cookie-based `URLSession` | All API auth | `OkHttp` with a persistent `CookieJar` (e.g. backed by `SharedPreferences` or a small DB) — **must persist across app restarts**, matching iOS's persistent cookie storage |
| `UserDefaults` / `@AppStorage` | Cover-photo pin, app/report language, step goal, nutrition goals | `SharedPreferences` or Jetpack `DataStore` |
| iOS 26 "Liquid Glass" (`.glassEffect`, `.buttonStyle(.glass)`) | Nearly all card/button chrome | **No direct equivalent** — this needs a deliberate Material 3 (or custom) reinterpretation; see §9 |
| Camera permission (`NSCameraUsageDescription`) | Barcode scanning only — no photo capture exists on iOS | `CAMERA` runtime permission, scoped the same way |
| HealthKit permission (`NSHealthShareUsageDescription`) | as above | Health Connect's own permission flow |

**Not present on iOS at all** — don't build unless scope is intentionally expanded: push notifications, widgets/Live-Activity equivalents, App Shortcuts/Quick Settings tiles, Spotlight-equivalent search indexing, background sync, photo capture (see §9 gaps).

---

## 8. Branding / design tokens

- **Palette** (fixed RGB, not theme-derived):
  - `paper` `#F2EEE6` — warm off-white, light-mode/report background
  - `ink` `#15130F` — near-black, dark-mode background
  - `lightInk` `#FBF9F4` — near-white foreground in dark mode
  - `trace` `#806450` — brown accent, the app's signature color
- **Brand mark:** a vertical "trace" symbol (SVG), used in 3 variants (brown-on-paper, white-on-dark, monochrome) — described in the design docs as "the sole branded carrier" of identity. Recreate as an SVG/vector drawable in the same 3 tonal variants.
- **Typography:** a serif font family for large editorial numerals/headlines (dates, step counts, calories, weight figures) — a consistent "serif hero number" motif running through every screen. Everything else (labels, chrome) uses the system sans-serif, with monospaced/tabular digits for aligned numeric columns (e.g. macro tables).
- **"Glass" card styling:** translucent, blurred-background capsules/cards used for the summary row, nutrition day header, etc. On Android, approximate with Material 3 surfaces (elevated/tonal surfaces, `Modifier.blur` where supported) rather than a literal frosted-glass shader — get close visually without chasing an unavailable API.
- **Layout conventions worth carrying over** (from the design doc governing the iOS build): no boxed/bordered panels on native activity screens; glass-card grouping for nutrition sections; consistent sheet/modal conventions for editors.
- **Orientation:** portrait-only on iOS. Decide whether Android should also lock portrait (recommended for parity/simplicity) or allow rotation.

---

## 9. Localization

- **3 supported languages:** English, Russian, Czech. Device-language auto-detection falls back to English if the device language isn't one of the three.
- **Two independent language settings** (both in Settings): **App language** (drives the whole UI) and **Report language** (used only for the exported nutrition PDF) — decouple these the same way on Android; someone may want an English UI but a Russian PDF to share with family, etc.
- ~205 string keys on iOS spanning auth, today, timeline, nutrition (+ report), activity, settings, and shared/common strings — plan for the equivalent `strings.xml` (×3 locales) coverage.
- **Known quirk to decide on purpose:** the nutrition-report share message text is **hard-coded in Russian** ("Привет! Отчет за …") regardless of the app/report language setting — this was an intentional-but-undocumented-elsewhere exception in the iOS code. Decide whether to localize it properly on Android or preserve the quirk for consistency with existing users' expectations.

---

## 10. Notable business logic & things worth a deliberate decision

- **Repeat-meal:** fully implemented — copies the *previous day's* entries for one meal type into the selected day, additively (never duplicates/overwrites). Straightforward to replicate 1:1 via the existing `/api/nutrition/entries/repeat` endpoint.
- **Cover-photo pinning:** client-only, no backend field — pins which photo (of a multi-photo session) shows as the Today hero, keyed by event ID, stored locally. Replicate as local-only state on Android too, or propose promoting it to a backend field if cross-device consistency matters now that there will be two clients.
- **InBody events show no data in the iOS app**, even though the backend (`src/domain/inbody-parser.ts`) extracts and stores ~15 named metrics (body water, protein, minerals, fat mass, skeletal muscle mass, BMI, body-fat %, InBody score, waist-hip ratio, visceral fat level, fat-free mass, BMR, obesity degree, SMI, recommended calorie intake) with per-metric category and body-segment tagging. **This is a real gap, not an intentional simplification** — the Android app could be the first client to actually surface this data, if desired.
- **No progress-photo capture in the iOS app** — despite the backend having full presign/upload/verify support (`/api/uploads/presign`, `/api/uploads/complete`), the iOS app only *displays* photos already uploaded via the web app. Same open question as InBody: worth deciding whether Android should be the first native client to implement capture.
- **Nutrition goal math** (the ±10% "on target" band, under/over amounts) is shared between the live Nutrition screen and the PDF export — implement once and reuse both places.
- **Left/right measurement asymmetry:** the backend stores separate left/right values for bicep (relaxed & flexed), thigh, calf, and a neck measurement, but the iOS UI only captures/shows one shared value per body part. Decide deliberately whether Android should expose true left/right entry (better data, more taps) or preserve the iOS simplification (faster entry, matches existing user habit/data if they've been using the iOS app).
- **Idempotency:** every food-entry creation call includes a client-generated UUID `idempotencyKey` to guard against duplicate submits on retry — carry this pattern over.
- **Forward-compatible event decoding:** unknown/future `TimelineEvent` types must decode to a generic "unsupported" placeholder rather than crashing or being dropped, so the Android app doesn't break when the backend adds new event types later (and vice versa — don't let a backend change break the older iOS client either).

---

## 11. Suggested Android tech stack (direct analogs of the iOS stack)

| Concern | iOS | Suggested Android |
|---|---|---|
| UI framework | SwiftUI | Jetpack Compose |
| Language | Swift | Kotlin |
| State/DI | `@Observable` classes, manual composition root (`AppRuntime`) | ViewModel + Hilt (or manual DI, given the app's small size) |
| Networking | `URLSession` + cookie jar | Retrofit or Ktor + OkHttp with persistent `CookieJar` |
| Health data | HealthKit | Health Connect |
| Barcode scanning | VisionKit | CameraX + ML Kit Barcode Scanning |
| Image loading | `AsyncImage` | Coil |
| Local key/value storage | `UserDefaults`/`@AppStorage` | Jetpack DataStore |
| PDF generation | PDFKit | Android `PdfDocument` |
| Charts | Swift Charts | Vico (Compose charting library) or custom Canvas |
| Min OS target | iOS 26 | Recommend targeting a recent-but-not-bleeding-edge API level (e.g. Android 14/15) rather than matching iOS's "latest only" policy, since Android's install base is more fragmented than iOS's |
