"use client";

import { Check } from "lucide-react";
import type { EventType } from "@/domain/events";
import { EventIcon } from "./icon";

export function TaskRow({
  type,
  title,
  detail,
  completed,
  onSelect
}: {
  type: EventType;
  title: string;
  detail: string;
  completed: boolean;
  onSelect: (type: EventType) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(type)}
      className="flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <EventIcon type={type} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      <span
        className="flex size-6 items-center justify-center rounded-full border"
        aria-label={completed ? "Completed" : "Not completed"}
      >
        {completed ? <Check aria-hidden="true" /> : null}
      </span>
    </button>
  );
}

