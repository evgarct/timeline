# Design System

## Product feel

Form is warm, monochrome, editorial, private, and photo-first. Avoid fitness gradients, gamification, dense dashboards, and decorative cards.

## Today

- The latest vertical photo owns the first viewport and extends under all safe areas.
- Readability comes from restrained black fades, not an opaque photo container.
- Date and actions overlay the photo; measurements emerge below in the same scroll document.
- System Liquid Glass is used for interactive chrome and grouped summary surfaces. Do not reproduce it with custom blur stacks.
- Use large serif system typography for dates and key values, SF Symbols for icons, and Dynamic Type everywhere else.

## Components and verification

Prefer native `TabView`, `NavigationStack`, sheets, alerts, `AsyncImage`, HealthKit authorization, and system accessibility behavior. Every meaningful native state needs deterministic `#Preview` coverage; behavior and accessibility are verified in UI tests and on a physical iPhone.

The approved visual direction is represented by the user-provided Today and Nutrition references. Real user media is never copied into repository assets or fixtures.
