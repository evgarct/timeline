"use client";

import { motion } from "motion/react";
import { spatial } from "@/lib/motion/tokens";

/** Glowing insertion line shown while a catalog exercise is dragged over the canvas. `y` is relative to the canvas. */
export function DropIndicator({ y, label }: { y: number; label: string }) {
  return (
    <motion.div
      aria-hidden
      data-testid="drop-indicator"
      initial={{ opacity: 0, scaleX: 0.6 }}
      animate={{ opacity: 1, scaleX: 1, y }}
      exit={{ opacity: 0 }}
      transition={{ y: spatial.fast, default: spatial.default }}
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-2"
    >
      <span className="h-1 flex-1 rounded-full bg-[var(--s-primary)] shadow-[0_0_20px_2px_var(--s-glow)]" />
      <span className="rounded-full bg-[var(--s-primary)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--s-on-primary)]">{label}</span>
    </motion.div>
  );
}
