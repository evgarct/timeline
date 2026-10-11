"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { effects } from "@/lib/motion/tokens";
import { BODY_VIEW, bodyBack, bodyFront, type BodyShape } from "./body-map-data";

/** Our canonical muscle id -> region slug(s) of the outline; same mapping as android/.../MuscleMap.kt. */
export function bodySlugs(muscle: string): string[] {
  switch (muscle) {
    case "chest": return ["chest"];
    case "lats": case "upper back": return ["upper-back"];
    case "lower back": return ["lower-back"];
    case "shoulders": return ["deltoids"];
    case "biceps": return ["biceps"];
    case "triceps": return ["triceps"];
    case "forearms": return ["forearm"];
    case "abs": return ["abs"];
    case "obliques": return ["obliques"];
    case "quads": return ["quadriceps"];
    case "hamstrings": return ["hamstring"];
    case "glutes": return ["gluteal"];
    case "calves": return ["calves"];
    case "adductors": return ["adductors"];
    case "traps": return ["trapezius"];
    case "neck": return ["neck"];
    default: return [];
  }
}

/** Opacity per muscle (0..1) is also accepted so dashboards can paint a heat map. */
export interface MuscleMapProps {
  primary?: string[];
  secondary?: string[];
  /** Heat map mode: muscle id -> intensity 0..1. Overrides primary/secondary. */
  intensity?: Record<string, number>;
  className?: string;
}

function View({ shapes, offsetX, levels }: { shapes: BodyShape[]; offsetX: number; levels: Map<string, number> }) {
  return (
    <svg viewBox={`${offsetX} 0 ${BODY_VIEW.width} ${BODY_VIEW.height}`} className="h-full w-auto" aria-hidden>
      {shapes.map((shape) => shape.paths.map((d, index) => (
        <path key={`${shape.slug}-n-${index}`} d={d} fill="var(--s-on-background)" fillOpacity={0.12} />
      )))}
      {shapes.map((shape) => shape.paths.map((d, index) => (
        <motion.path
          key={`${shape.slug}-p-${index}`}
          d={d}
          fill="var(--s-primary)"
          initial={{ fillOpacity: 0 }}
          animate={{ fillOpacity: levels.get(shape.slug) ?? 0 }}
          transition={effects.slow}
        />
      )))}
    </svg>
  );
}

/** Front and back body outlines with animated fills: neutral 12% / secondary 40% / primary 100%, as on Android. */
export function MuscleMap({ primary = [], secondary = [], intensity, className }: MuscleMapProps) {
  const levels = useMemo(() => {
    const map = new Map<string, number>();
    if (intensity) {
      for (const [muscle, value] of Object.entries(intensity)) {
        for (const slug of bodySlugs(muscle)) map.set(slug, Math.max(map.get(slug) ?? 0, Math.min(1, Math.max(0, value))));
      }
      return map;
    }
    for (const muscle of secondary) for (const slug of bodySlugs(muscle)) map.set(slug, 0.4);
    for (const muscle of primary) for (const slug of bodySlugs(muscle)) map.set(slug, 1);
    return map;
  }, [primary, secondary, intensity]);

  return (
    <div className={cn("flex h-full items-center justify-center gap-1", className)} role="img" aria-label="Muscle map">
      <View shapes={bodyFront} offsetX={0} levels={levels} />
      <View shapes={bodyBack} offsetX={BODY_VIEW.backOffsetX} levels={levels} />
    </div>
  );
}
