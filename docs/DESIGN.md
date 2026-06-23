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
- Forms use `FieldGroup`, `Field`, `FieldLabel`, and shared inputs.
- Buttons use existing variants and lucide icons with `data-icon`.
- New user-facing text must be added to RU/EN/CS dictionaries.
- New UI screens or meaningful states should get Storybook coverage when practical.

## Accepted Patterns

- Latest progress photo as Today background: use a blurred signed thumbnail/full URL only at render time, with a stored optional palette for pastel gradients.
- Storage usage in Settings: show quota as compact profile metadata, not as a separate billing page.
- Landing/product bridge: landing primary CTA opens the product for signed-in users; product header keeps a compact link back to landing.

## Update Process

- Before UI work: read this file and follow the existing product feel.
- During review: compare the result against this document and the live mobile viewport.
- After the user says the result is good: add the reusable principle or pattern here with a short concrete example.
- Do not add one-off implementation details, temporary bugs, or unaccepted experiments.
