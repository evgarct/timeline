import type { Transition } from "motion/react";

/**
 * Port of Material 3 Expressive `MotionScheme.expressive()` (the scheme the Android app runs on).
 * Values are the springs from androidx `ExpressiveMotionTokens`: damping is a ratio, stiffness is in N/m.
 * Motion's spring wants an absolute damping coefficient, so `m3Spring` converts: c = ratio * 2 * sqrt(k * m), m = 1.
 */
export function m3Spring(stiffness: number, dampingRatio: number): Transition {
  return { type: "spring", stiffness, damping: dampingRatio * 2 * Math.sqrt(stiffness), mass: 1 };
}

/** Position, size and layout changes: bouncy, because expressive. */
export const spatial = {
  fast: m3Spring(800, 0.6),
  default: m3Spring(380, 0.8),
  slow: m3Spring(200, 0.8)
} as const;

/** Opacity and colour: critically damped, never overshoots (an alpha of 1.04 is not a thing). */
export const effects = {
  fast: m3Spring(3800, 1),
  default: m3Spring(1600, 1),
  slow: m3Spring(800, 1)
} as const;

/** The same spec Android uses to collapse a section: tween(220) + fade tween(150). */
export const collapse = {
  size: { duration: 0.22, ease: [0.2, 0, 0, 1] },
  fade: { duration: 0.15, ease: "linear" }
} as const satisfies Record<string, Transition>;

export const motionTokens = { spatial, effects, collapse } as const;
