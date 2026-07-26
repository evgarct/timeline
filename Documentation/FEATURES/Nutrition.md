# Nutrition

## Product database

The catalog is private and owner-scoped. A product stores one or more nutrient bases and every readable label row, including unknown manufacturer nutrients. Each value retains its original label, unit, qualifier, optional daily-value percentage, and `stated`, `calculated`, or `estimated` provenance. Salt and sodium and individual fat/sugar types remain separate.

ChatGPT analyzes attached packaging or produce photos. The MCP server receives structured data only and does not store those images. Exact barcodes reuse a product. Without a barcode, only one exact normalized name/brand match may be reused.

Connection and verification steps are documented in [MCP.md](../MCP.md).

## Journal

Breakfast, lunch, dinner, and snack entries are Timeline events. Entries accept grams, milliliters, or a product-specific piece size. Their full scaled nutrient snapshot is durable history. The native app can search the complete catalog, add food, and edit or delete journal entries on past, current, or future days.

The daily surface shows calories and protein/fat/carbohydrates without targets. Full macro- and micronutrient details are disclosed on demand and mark calculated or estimated data.

## Daily PDF report

An export button on the nutrition screen renders the selected day (macros, fiber, fat/carb composition proxies, full per-meal table, weekly trend vs. optional goals, and activity) into a two-page landscape PDF plus a Telegram-preview (OG) image, on-device via `NutritionReportRenderer`/`NutritionReportView`. Both are uploaded and a public `/r/<id>` link is returned, valid for 10 days; real visitors are redirected straight to the PDF, while link-preview crawlers (identified by user-agent) see the OG-tagged landing page instead so chat apps can build a rich preview card.

The cover page's activity half additionally requests read access to `HKObjectType.workoutType()` and `.activeEnergyBurned` (alongside the existing step/distance types) and queries `HKSampleQuery` for workouts on the report's day. Each is mapped to a `WorkoutKind` (running, walking, cycling, swimming, hiking, yoga, strength training, HIIT, core, elliptical, rowing, or a generic fallback for any other `HKWorkoutActivityType`) with its own icon and name, shown beside the day's step figure with duration and — when HealthKit has it — calories burned. As with steps/distance, a denied or unavailable workout query never blocks the rest of the report: it just renders with no workout shown. The cover page is a fixed-size canvas, so at most 3 workouts are shown individually; any beyond that are summarized as a plain "+N" rather than pushing the chart off the page.
