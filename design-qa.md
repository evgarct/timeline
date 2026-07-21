# Fitness Timeline Design QA

- Source visual truth: `C:\Users\PC\.codex\generated_images\019eefcc-4db1-7d51-b615-16b06de7522c\ig_0e8cd41bb731a4e1016a394c95f7ac8191831f11d0b532eff9.png`
- Implementation screenshots:
  - `C:\Projects\timeline\.qa-landing.png`
  - `C:\Projects\timeline\.qa-today-final.png`
  - `C:\Projects\timeline\.qa-event.png`
- Combined comparison: `C:\Projects\timeline\.qa-comparison.png`
- Viewport: 393 × 852 CSS pixels
- State: Russian locale, demo authenticated, populated Today and Timeline

## Full-view comparison

The implementation preserves the source hierarchy and interaction model: quiet warm canvas, restrained monochrome controls, typography-led landing, photo-forward current state, compact event rows, a single Today-to-Timeline scroll document, and a focused event detail page.

## Focused comparison

Landing, Today/Timeline, and progress-photo detail were inspected independently because typography, media crops, row anatomy, and destructive actions were too small to judge reliably from the combined board alone.

## Fidelity surfaces

- Typography: Geist closely matches the Apple-like neo-grotesk source. Heading scale, compact labels, weights, and mobile wrapping are consistent.
- Spacing and rhythm: 16px mobile gutters, generous section gaps, compact rows, soft radii, and safe-area ownership match the intended density.
- Colors and tokens: warm off-white background, near-black foreground, subtle neutral borders, muted labels, and restrained destructive red are implemented through semantic CSS variables.
- Image quality: generated front/side/back assets are consistent, sharp, naturally cropped, and used as real raster media rather than placeholders.
- Copy: core Russian source copy is preserved; English and Czech variants use the same semantic message contract.

## Findings and patches

- Fixed P2: recent events incorrectly inherited the Timeline rail and dots. Added a rail-free row variant for the Recent section.
- Fixed P2: Timeline dates used raw ISO values. Added localized Today/Yesterday/day-month labels.
- Verified no P0/P1/P2 findings remain.

## Follow-up polish

- P3: the number of visible Today tasks is schedule-dependent, so the current Monday fixture shows one due task while the concept board shows three.
- P3: browser screenshots intentionally omit the decorative iPhone hardware frame from the presentation board.

final result: passed

---

# Native Today photo-first polish

## Sources

- Reference: `C:\Users\PC\iCloudPhotos\Photos\AA5CA0F8-C7A0-462D-8362-CB7BFFF00515.png`
- Implementation capture: `C:\Users\PC\.codex\visualizations\2026\07\21\019f85a1-0511-76e1-be59-c4b9801abd95\Form-Today-polish-final.png`
- Combined comparison: `C:\Users\PC\.codex\visualizations\2026\07\21\019f85a1-0511-76e1-be59-c4b9801abd95\Form-Today-comparison.jpg`
- Viewport: iPhone 15 Pro, iOS 26.5, portrait (393 × 852 points).

## Iteration history

1. The first implementation let the serif Details heading peek through behind the tab bar.
2. The hero received a black scroll runway after the visible composition so the summary remains in place while Details starts entirely below the initial viewport.
3. Re-ran the live production-session UI test with eight private portrait photos and compared the resulting screenshot beside the reference at the same aspect ratio.

## Final result

Passed. The portrait subject remains visible from head to feet, photo controls and the compact nutrition/activity shelf occupy the lower edge, the editorial date and 18-point gutters track the reference, and no Details content is visible before scrolling.

---

# Native activity and fixed-photo interaction

## Sources and state

- Visual truth: `C:\Users\PC\iCloudPhotos\Photos\AA5CA0F8-C7A0-462D-8362-CB7BFFF00515.png`
- Initial implementation: `C:\Users\PC\.codex\visualizations\2026\07\21\019f85a1-0511-76e1-be59-c4b9801abd95\Form-activity-initial.png`
- Scrolled implementation: `C:\Users\PC\.codex\visualizations\2026\07\21\019f85a1-0511-76e1-be59-c4b9801abd95\Form-activity-scrolled.png`
- Full comparison: `C:\Users\PC\.codex\visualizations\2026\07\21\019f85a1-0511-76e1-be59-c4b9801abd95\Form-activity-comparison.jpg`
- Viewport: iPhone 15 Pro, iOS 26.5, portrait (393 × 852 points).
- State: production test account with eight private portrait photos; initial activity 12,000 of 12,000.

## Findings and iteration history

- The first interaction implementation exposed the activity region as a gesture-only accessibility button, so XCTest could long-press it but could not prove tap-driven refresh. Replaced it with a native `Button` plus a simultaneous system long-press gesture.
- The initial and post-scroll screenshots confirm the photo pixels remain stationary while header, actions, summary, and Details move through the foreground scroll document.
- No remaining P0/P1/P2 differences. The summary contains the reference's current values, units, targets, progress tracks, macro footer, goal percentage, divider, and action icon. Serif values, uppercase labels, gutters, monochrome palette, system icons, photo crop, and localized copy are consistent with the accepted direction.

Focused region comparison was not needed because the full-height side-by-side image keeps the complete summary legible; the separate post-scroll capture is the focused motion-state evidence.

final result: passed
