# Design System

## Product feel

Form is warm, monochrome, editorial, private, and photo-first. Avoid fitness gradients, gamification, dense dashboards, and decorative cards.

## Today

- The latest vertical photo owns the first viewport and extends under all safe areas.
- Treat the iPhone 15 Pro portrait viewport (393 × 852 points) as the primary composition: preserve nearly the full vertical photo, keep its subject clear, and reserve only the compact action and summary shelf at the bottom.
- Readability comes from restrained black fades, not an opaque photo container.
- Date and actions overlay the photo; measurements emerge below in the same scroll document.
- The photo is a fixed fullscreen background layer: scrolling moves the date, controls, summary, and timeline content while the selected photo remains visually stationary behind them.
- The first Details heading must be completely outside the initial viewport, including behind the system tab bar; it appears only after an intentional upward scroll.
- Match the approved reference with 18-point side gutters, an editorial serif date, compact uppercase labels, and tightly grouped system controls.
- System Liquid Glass is used for interactive chrome and grouped summary surfaces. Do not reproduce it with custom blur stacks.
- Use large serif system typography for dates and key values, SF Symbols for icons, and Dynamic Type everywhere else.
- The activity half of the summary is one large touch target. It loads the current HealthKit snapshot automatically, tap refreshes it, and touch and hold opens a three-action native context menu: set goal, open details, or share.

## Brand assets

- The approved trace symbol is the only branded mark. Use the primary brown-on-paper asset on light editorial surfaces, the white-on-ink asset on dark surfaces, and the monochrome asset for tinted or single-color contexts.
- App icons, favicons, and PWA icons are generated from the canonical SVG masters in `Documentation/Brand`; generated raster files are never edited independently.
- Branded carriers use the trace symbol. Functional controls continue to use SF Symbols so their meaning and accessibility remain familiar on iPhone.

## Activity detail and sharing

- Activity details open as a full-screen, dark editorial surface. Steps today remain the largest element; the current Monday-to-today average must also be visible as a number, not only as a chart rule.
- The weekly chart covers Monday through Sunday, distinguishes elapsed days from future days, and uses a restrained monochrome line/area treatment rather than fitness gradients or gamification.
- Distance may accompany steps when HealthKit supplies it. Missing optional metrics disappear cleanly rather than showing fabricated values.
- The share artifact is a purpose-built branded image, not a screenshot of application chrome. It contains today's steps, the current weekly average, the weekly chart, goal progress, and optional distance, without private progress photography.

## Components and verification

Prefer native `TabView`, `NavigationStack`, sheets, alerts, `AsyncImage`, HealthKit authorization, and system accessibility behavior. Every meaningful native state needs deterministic `#Preview` coverage; behavior and accessibility are verified in UI tests and on a physical iPhone.

The approved visual direction is represented by the user-provided Today and Nutrition references. Real user media is never copied into repository assets or fixtures.
