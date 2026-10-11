# Fitness Timeline Design Principles

This document is the design source of truth for UI work in this repository. Read it before changing product UI, and update it after a UI result is accepted as a reusable pattern.

## Product Feel

- Fitness Timeline is a private, mobile-first body history, not a dashboard or marketing site.
- The interface should feel calm, tactile, personal, and fast on iPhone.
- Today and Timeline live in one scroll document. Navigation should support returning to the landing page, but should not split Timeline into a separate route.
- Progress photos are the emotional anchor. Use them as real visual material when available, with privacy-preserving signed URLs and soft treatment.

## Visual Language

- Use the existing warm neutral base: `--background`, `--card`, `--muted`, `--accent`, `--foreground`.
- Surfaces should be quiet and functional: `surface`, thin borders, soft shadows, restrained blur.
- Avoid decorative containers that do not group content or improve interaction.
- Prefer row-based repeated content over separate cards when the items are part of one list.
- Keep radii consistent with existing rounded-xl product surfaces unless a base component defines the radius.
- Do not introduce one-note palettes. Photo-derived color should be pastel, muted, and secondary to readable content.

## Mobile Interaction

- Design for iPhone first: safe areas, thumb reach, native pickers, and standalone web app behavior matter.
- Use one clear primary action for photo upload when iOS already exposes camera and library from the same picker.
- Use native date input for day-level progress-photo dates; save day-level photos at local noon to avoid timezone drift.
- Icon-only buttons need accessible labels and should use existing lucide icons through shadcn `Button`.
- For portal, drawer, dialog, and lightbox UI, verify the rendered element in the real document, not only the component tree.

## Media And Wallpaper

- Real user uploads and medical reports are private. Never place them in `public/` or fixtures.
- Progress photos are normalized to metadata-free JPEG full and thumbnail objects before storage.
- Product wallpaper uses the latest progress photo by default in v1.
- Wallpaper treatment should be layered: pastel base from photo palette, softened/blurred photo, top and bottom fades, readable foreground.
- Store durable media references and lightweight metadata only; never store presigned URLs in event payloads.

## Components

- Use the existing shadcn/ui primitives and local components before creating new UI.
- For mobile-first product surfaces, prefer Ant Design Mobile primitives for native mobile structure such as safe areas, lists, sheets, and touch-first controls, then theme them through local tokens so they still match the Fitness Timeline visual language.
- UI development starts in Storybook. Add or update stories for every new or meaningfully changed screen, component, and state before verifying the integrated app.
- Storybook coverage should include loading/empty/error/success states, mobile-first layout states, important localized variants, and interaction states that can be represented without live services.
- Prefer component-level Storybook iteration to broad app-level editing so UI work stays focused, reviewable, and cheap to reason about.
- Forms use `FieldGroup`, `Field`, `FieldLabel`, and shared inputs.
- Buttons use existing variants and lucide icons with `data-icon`.
- New user-facing text must be added to RU/EN/CS dictionaries.
- App/browser verification comes after Storybook coverage and should confirm routing, portals, data wiring, and real viewport behavior.

## Accepted Patterns

- Native nutrition journal: use one calm document with row-based collapsible breakfast, lunch, dinner, and snack sections. Do not show a separate giant daily-total hero number — the per-row kcal column (emphasized in the macro row) is the only calorie total on screen. Keep micronutrients behind an explicit “All nutrients” disclosure reachable from an overflow menu, not a full-width row, preserve neutral provenance labels for calculated/estimated values, allow vertical scrolling, and avoid goals, macro colors, streaks, or food photography.
- Native iOS screens (Form target), revised: the flat, card-free typography-only treatment for the Nutrition day total and meal sections read as unfinished and sparse in practice (large dead vertical gaps, no anchor for the eye), so those two groupings now use `.glassEffect(.regular, in: .rect(cornerRadius: 26))` — the day total and each meal's header/macro-row/entry-list is one glass surface. Item rows inside a meal's card are separated by a subtle hairline (`.white.opacity(0.12)`), not re-boxed individually. Still avoid wrapping every minor element in its own panel, and still use typography weight/size/color for hierarchy *within* a grouped surface; the rule against decorative one-off containers stands, only the "never group static content in glass" absolute was too strict.
- Native iOS page headers: skip a large page-title header when the tab bar already names the screen. Gather date/day navigation and secondary actions (calendar, overflow menu) into one compact control cluster in the top-right corner instead of a full-width title row.
- Native iOS list/detail rows: define one reusable row view per domain object (e.g. `NutritionItemRow`) and reuse it across the day list, search/browse lists, and any other place the same object appears, so spacing and typography stay identical everywhere. A row is a single name line (no secondary brand/store line — that's noise in a scanning list) plus one breakdown line below it; never repeat the same total (e.g. calories) in two places in the same row or between a row and its section header.
- Native iOS sheets: always show the system drag indicator (`.presentationDragIndicator(.visible)`) so a modal's dismiss affordance is visible without relying on the nav bar Cancel button. When a sheet needs Cancel/Save, prefer a custom compact top bar (plain text buttons in a slim `HStack`, nav bar hidden) over the default system toolbar, which renders oversized glass pill buttons that eat vertical space on iOS 26.
- Native iOS product picker (add-to-meal): split browsing (no search query yet) into two sections — products previously logged in this specific meal, most recent first, then everything else by recency, excluding items already shown above. Page each section at 20 items with a "Show more" affordance rather than loading the full history at once. Typing a query replaces both sections with a flat search-result list.
- Native iOS quantity entry: when a product exposes more than one stated portion (piece/serving sizes, alternate stated bases like "per portion (330 ml)"), surface them as quick-select chips alongside the plain 100 g/ml default, so the user isn't limited to typing a gram/ml amount.
- TRACE identity: use the approved vertical trace symbol as the sole branded carrier. Primary is brown on warm paper, dark is white on near-black, and monochrome supports tinted/small-scale contexts; retain semantic system icons for functional controls.
- Native activity detail: use a quiet, icon-led editorial composition. `figure.walk`, `target`, `chart.xyaxis.line`, and `ruler` carry unambiguous metric meaning; the selected step count stays dominant, while goal, average, chart, and distance form one calm reading order without duplicate headings.
- Historical activity navigation belongs inside the detail screen. Day arrows move one day at a time, the compact date control opens a native calendar, and future dates are unavailable. The selected chart point is dominant; other points are deliberately subdued.
- Activity sharing: render the same semantic palette, typography, chart, and metric composition as the detail screen in the active color scheme. The 1080 × 1350 artifact omits navigation chrome, slogans, advertising, and the private progress-photo background.
- Latest progress photo as Today background: use a blurred signed thumbnail/full URL only at render time, with a stored optional palette for pastel gradients.
- Today mirror screen: the first viewport is a full-height photo-first surface, not a dashboard. The user should see the latest body photo before Timeline, metrics, charts, or navigation.
- Today and Timeline transition: keep them in one scroll document, with Timeline emerging only after vertical scroll from the Today photo surface.
- Today photo treatment: the latest progress photo should feel like the screen itself. Prefer full-bleed rendering with top/bottom readability fades and safe full-body framing; avoid visible photo containers, decorative frames, or preview-card treatment.
- Today photo-screen composition: the hero photo starts at viewport top and owns the full first viewport, including the area under iOS status bars; apply safe area only to overlay text and controls, never to the photo layer.
- Today photo background layer: implement the first viewport photo as a fullscreen background layer behind all interface chrome, not as an image inside the content layout. Bottom sheets and overlays must sit over the photo, with the photo visually continuing underneath them.
- Today photo crop and motion: use a gentle 10-15% visual zoom with a lower transform origin so the crop removes ceiling before feet; keep Ken Burns motion one-way, slow, and low-amplitude.
- Today angle navigation: keep the collapsed Today surface visually still. Do not show carousel dots or angle controls unless the user is explicitly browsing the photo session.
- Today motion: use slow, low-amplitude photo motion and soft fade/translate transitions. Avoid bounce, carousel-like speed, flashy effects, and motion that competes with the photo.
- Today context: photo overlays may show memory-like context such as date, day, time, place, or training phase. Body metrics are hidden until the user explicitly asks for details.
- Today actions sheet: daily actions sit in an iOS-like glass bottom sheet over the photo. Keep actions calm, row-based, monochrome, and free of warning colors or progress percentages.
- Today bottom drawer sizing: default to a compact 100-150px preview above the safe area, with all daily action items visible in that preview.
- Today bottom drawer behavior: the compact preview should read as a quiet text list; dragging it upward should smoothly expand it into full action cards with icons, status details, and stronger material styling.
- Today bottom sheet material: keep the sheet translucent enough that the photo still reads underneath it; prefer stronger blur and lighter opacity over a flat white container.
- Today drawer preview: the first viewport bottom drawer is pinned to the viewport bottom; PWA initial safe-area scroll may crop the photo but must not move the drawer.
- Storage usage in Settings: show quota as compact profile metadata, not as a separate billing page.
- InBody test (event page, web; the Android sheet follows the same order): open with the date and a quiet "checked / not checked yet" line, then an "Open original" outline button, then four key numbers (score, weight, muscle, body fat) as a 2x2 grid with the signed change since the previous test under each. Below, the printed sections in sheet order, each one surface of rows: label left, change and value right, and under each value the sheet's normal range as a thin band with the reading as a dot plus "Normal a–b" and the sheet's own verdict (below / normal / above). Segmental lean and fat are two body grids (arms, trunk, legs: kg, %, verdict), impedance is a small table by frequency, the 30-minute calorie table folds away. Changes and verdicts are neutral: no green/red, no goals, no score colouring. Sections that the sheet lacks are omitted, never shown empty. Text comes from the RU/EN/CS dictionaries; a reading without a translation keeps the label stored with it.
- Timeline row for InBody: one line of headline numbers (score, weight, muscle, body fat) with localized labels; the sheet itself lives on the event page.
- Landing/product bridge: landing primary CTA opens the product for signed-in users; product header keeps a compact link back to landing.

## Studio (web strength builder and dashboards)

Studio is the desktop-first web surface for workouts. It deliberately differs from the calm mobile Today surface: brighter, more motion, still on the Android brand.

- Scope: tokens live under `[data-surface="studio"]` (`src/styles/studio-tokens.css`) and are semantic M3-style roles (`--s-surface-container`, `--s-primary-container`, `--s-outline-variant`). Dark mode redefines the roles; never pick a light colour inside a component.
- Brand parity with Android: Paper `#F2EEE6` / Ink `#15130F` / Trace `#806450`, serif for titles and hero numbers (`SerifNumber`: value serif, unit sans at 0.45x), tabular digits on every number, eyebrow = 11px/600/+0.1em uppercase, radii 14/16/20/24/28. Depth comes from surface-container tiers, not shadows.
- Brighter web layer (Studio only): soft Trace glow on hover/active/PR and a radial page gradient. Glow and gradients are always derived from `--s-primary` and never carry meaning.
- Motion = Material 3 Expressive springs ported from Android (`src/lib/motion/tokens.ts`, values from androidx `ExpressiveMotionTokens`): spatial (position/size/layout) fast 800/0.6, default 380/0.8, slow 200/0.8; effects (opacity/colour) are critically damped 3800/1600/800. Collapse = tween 220ms + fade 150ms, as on Android. Everything honours `prefers-reduced-motion`.
- Interaction: filter chips share a `layoutId` pill that glides between chips; cards lift 2px on hover; buttons scale to 0.96 on press; lists reorder with layout animations and a dragged card gets scale 1.02 plus a glow.
- Muscle map: same outlines and region mapping as Android (`MuscleMap.kt`), neutral 12% / secondary 40% / primary 100%; the dashboard reuses it as a heat map via a per-muscle intensity.
- Charts are plain SVG/CSS with the same springs (bars grow, lines draw their stroke); no chart dependency. Volume stays neutral: no goals, streaks or good/bad colouring.
- Body page (`/studio/body`): a trend card first (metric chips with the shared `layoutId` pill, the latest value as a serif hero number, the change since the first test, one line chart across tests with min and max on the right and first/last dates under it), then one card per test, newest first. A test card shows the date, "checked / not checked yet", the original and "open the full sheet" links, four headline numbers with the change since the previous test, and a "Between the tests" block (diet days logged with average kcal and macros, steps, workouts, progress-photo dates, nearest tape measurements) so every number comes with its explanation. States: loading skeleton, load error, empty (asks the agent to add a test from the printed sheet), single test (chart replaced by a hint to add a second one). A narrow range such as a ratio must still fill the plot.
- Builder layout: side panels that are only needed while composing (the exercise catalog) fold into a slim rail, and the choice is remembered; an existing template opens with the catalog folded. A section with several screens (templates) keeps a breadcrumb and a switcher in its header so the person never has to go through the global navigation to change template; every link asks first while there are unsaved changes.
- "What exercise is this?": a thumbnail opens a detail dialog with both photo frames at reading size, muscles (chips and the muscle map), technique, the trainer's note and the how-to video. The trainer's note and the technique are different texts (per program vs per exercise) and are labelled apart. YouTube plays in place through a click-to-load facade (thumbnail first, `youtube-nocookie.com` iframe only after the click).

## Update Process

- Before UI work: read this file and follow the existing product feel.
- During UI work: iterate in Storybook against the relevant component or screen states before changing broader app flows.
- During review: compare the result against this document and the live mobile viewport.
- After the user says the result is good: add the reusable principle or pattern here with a short concrete example.
- Do not add one-off implementation details, temporary bugs, or unaccepted experiments.
