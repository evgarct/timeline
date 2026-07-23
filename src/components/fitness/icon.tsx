import { Camera, Dumbbell, FileText, Ruler, Utensils, type LucideIcon } from "lucide-react";
import type { EventType } from "@/domain/events";

const icons: Record<EventType, LucideIcon> = {
  progress_photo: Camera,
  workout: Dumbbell,
  measurements: Ruler,
  inbody: FileText,
  nutrition_entry: Utensils
};

export function EventIcon({ type }: { type: EventType }) {
  const Icon = icons[type];
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
      <Icon aria-hidden="true" />
    </span>
  );
}

