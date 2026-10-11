"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type HTMLMotionProps } from "motion/react";
import { useEffect, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { effects, spatial } from "@/lib/motion/tokens";

export function Eyebrow({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("s-eyebrow", className)} {...props} />;
}

/** Android's hero-number motif: serif value, sans unit at 0.45x. */
export function SerifNumber({ value, unit, size = 32, className }: { value: ReactNode; unit?: string; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      <span className="s-serif s-num leading-none" style={{ fontSize: size }}>{value}</span>
      {unit ? <span className="text-[var(--s-on-surface-variant)]" style={{ fontSize: size * 0.45 }}>{unit}</span> : null}
    </span>
  );
}

/** Counts up to `value` on a critically damped spring (effects.default); static under reduced motion. */
export function NumberTicker({ value, decimals = 0, className }: { value: number; decimals?: number; className?: string }) {
  const reduce = useReducedMotion();
  const raw = useMotionValue(reduce ? value : 0);
  const spring = useSpring(raw, { stiffness: 140, damping: 24, mass: 1 });
  const text = useTransform(reduce ? raw : spring, (v) => v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  useEffect(() => { raw.set(value); }, [raw, value]);
  return <motion.span className={cn("s-num", className)}>{text}</motion.span>;
}

type SurfaceTone = "container" | "high" | "highest" | "primary";
const tones: Record<SurfaceTone, string> = {
  container: "bg-[var(--s-surface-container)]",
  high: "bg-[var(--s-surface-container-high)]",
  highest: "bg-[var(--s-surface-container-highest)]",
  primary: "bg-[var(--s-primary-container)]"
};

/** Depth through surface-container tiers, not shadows (Android is flat). `interactive` adds the Trace glow on hover. */
export function Surface({ tone = "container", interactive, className, ...props }: HTMLMotionProps<"div"> & { tone?: SurfaceTone; interactive?: boolean }) {
  return (
    <motion.div
      whileHover={interactive ? { y: -2 } : undefined}
      transition={spatial.fast}
      className={cn(
        "rounded-[var(--s-radius-xl)] border border-[color-mix(in_srgb,var(--s-outline-variant)_50%,transparent)] text-[var(--s-on-background)] transition-shadow",
        tones[tone],
        interactive && "cursor-pointer hover:shadow-[0_0_0_1px_var(--s-primary),0_12px_40px_-12px_var(--s-glow)]",
        className
      )}
      {...props}
    />
  );
}

type ButtonVariant = "primary" | "tonal" | "ghost" | "danger";
const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-[var(--s-primary)] text-[var(--s-on-primary)] hover:shadow-[0_8px_32px_-8px_var(--s-glow)]",
  tonal: "bg-[var(--s-surface-container-high)] text-[var(--s-on-background)]",
  ghost: "bg-transparent text-[var(--s-on-surface-variant)] hover:bg-[var(--s-surface-container)]",
  danger: "bg-transparent text-[var(--s-error)] hover:bg-[color-mix(in_srgb,var(--s-error)_12%,transparent)]"
};

export function StudioButton({ variant = "primary", size = "md", className, ...props }: HTMLMotionProps<"button"> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      transition={spatial.fast}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-[var(--s-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--s-background)]",
        "disabled:pointer-events-none disabled:opacity-40",
        size === "sm" && "h-8 rounded-[var(--s-radius-sm)] px-3 text-[13px]",
        size === "md" && "h-11 rounded-[var(--s-radius-md)] px-4 text-[15px]",
        size === "lg" && "h-14 rounded-[18px] px-6 text-[17px]",
        buttonVariants[variant],
        className
      )}
      {...props}
    />
  );
}

/** Filter chip. The active state is a shared `layoutId` pill, so it glides between chips of one group. */
export function Chip({ active, groupId, count, children, className, ...props }: Omit<HTMLMotionProps<"button">, "children"> & { active?: boolean; groupId?: string; count?: number; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      aria-pressed={active}
      whileTap={{ scale: 0.95 }}
      transition={spatial.fast}
      className={cn(
        "relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--s-primary)]",
        active ? "text-[var(--s-on-primary)]" : "bg-[var(--s-surface-container)] text-[var(--s-on-surface-variant)] hover:bg-[var(--s-surface-container-high)]",
        className
      )}
      {...props}
    >
      {active ? <motion.span layoutId={groupId ? `chip-${groupId}` : undefined} transition={spatial.default} className="absolute inset-0 -z-0 rounded-full bg-[var(--s-primary)]" /> : null}
      <span className="relative z-10">{children}</span>
      {count !== undefined ? <span className="relative z-10 s-num text-[11px] opacity-60">{count}</span> : null}
    </motion.button>
  );
}

/** +/- stepper with a numeric field, tabular digits; the value flips with an effects-spring slide. */
export function Stepper({ value, min = 0, max = 99, step = 1, onChange, label, suffix }: { value: number | undefined; min?: number; max?: number; step?: number; onChange: (value: number) => void; label: string; suffix?: string }) {
  const current = value ?? 0;
  const clamp = (next: number) => onChange(Math.min(max, Math.max(min, Math.round(next * 100) / 100)));
  return (
    <div className="flex h-11 items-center rounded-[var(--s-radius-sm)] bg-[var(--s-surface-container-highest)]" role="group" aria-label={label}>
      <button type="button" aria-label={`${label} −`} onClick={() => clamp(current - step)} className="h-full w-9 rounded-l-[var(--s-radius-sm)] text-lg text-[var(--s-on-surface-variant)] transition-colors hover:bg-[var(--s-surface-container-high)] active:scale-90">−</button>
      <label className="relative flex min-w-12 flex-1 items-center justify-center">
        <input
          inputMode="decimal"
          aria-label={label}
          value={value === undefined ? "" : String(value)}
          placeholder="–"
          onChange={(event) => {
            const parsed = Number(event.target.value.replace(",", "."));
            if (event.target.value === "") onChange(min);
            else if (Number.isFinite(parsed)) clamp(parsed);
          }}
          className="s-num w-full bg-transparent text-center text-base outline-none placeholder:opacity-40"
        />
        {suffix ? <span className="pointer-events-none absolute right-1 text-[10px] text-[var(--s-on-surface-variant)]">{suffix}</span> : null}
      </label>
      <button type="button" aria-label={`${label} +`} onClick={() => clamp(current + step)} className="h-full w-9 rounded-r-[var(--s-radius-sm)] text-lg text-[var(--s-on-surface-variant)] transition-colors hover:bg-[var(--s-surface-container-high)] active:scale-90">+</button>
    </div>
  );
}

export { effects, spatial };
