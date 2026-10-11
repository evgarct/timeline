import type { TaskSchedule, TimelineEvent } from "@/domain/events";
import { fabricatedInBodyMetrics } from "./seed-inbody";

const date = (daysAgo: number, hour = 8) => {
  const value = new Date();
  value.setDate(value.getDate() - daysAgo);
  value.setHours(hour, 12, 0, 0);
  return value;
};

export const seedEvents: TimelineEvent[] = [
  {
    id: "4da47482-5790-4d58-9650-e545dfd958ad",
    type: "workout",
    occurredAt: date(0, 7),
    timezone: "Europe/Prague",
    completed: true,
    muscleGroups: ["Push"]
  },
  {
    id: "2ebcaef5-8ad7-458c-bd99-3d5e4b17a9a9",
    type: "measurements",
    occurredAt: date(1),
    timezone: "Europe/Prague",
    values: { weightKg: 85.1, waistCm: 74, chestCm: 104 }
  },
  {
    id: "90d785fe-aeb1-43ac-8531-af67d5234b89",
    type: "progress_photo",
    occurredAt: date(5),
    timezone: "Europe/Prague",
    note: "Чувствую себя отлично. Сон и питание стабильные.",
    photos: [
      { id: "front", url: "/demo/progress-front.png", alt: "Front progress view" },
      { id: "side", url: "/demo/progress-side.png", alt: "Side progress view" },
      { id: "back", url: "/demo/progress-back.png", alt: "Back progress view" }
    ]
  },
  {
    id: "7e5839e1-0274-4969-be96-a96e407fd9bf",
    type: "inbody",
    occurredAt: date(6, 16),
    timezone: "Europe/Prague",
    source: { url: "/demo/inbody-sample.jpg", mimeType: "image/jpeg", fileName: "InBody-demo-latest.jpg" },
    report: { device: "InBody270", heightCm: 180, ageYears: 33, gender: "male" },
    extraction: { method: "mcp_agent", reviewed: true },
    metrics: fabricatedInBodyMetrics(1)
  },
  {
    id: "0f6f2d4c-0b2a-4b53-9d0e-5c3b1a7e6a10",
    type: "inbody",
    occurredAt: date(120, 9),
    timezone: "Europe/Prague",
    source: { url: "/demo/inbody-sample.jpg", mimeType: "image/jpeg", fileName: "InBody-demo-start.jpg" },
    report: { device: "InBody270", heightCm: 180, ageYears: 33, gender: "male" },
    extraction: { method: "mcp_agent", reviewed: true },
    metrics: fabricatedInBodyMetrics(0)
  },
  {
    id: "8c009177-4ff4-473d-af6d-b073d9ba4a31",
    type: "workout",
    occurredAt: date(9),
    timezone: "Europe/Prague",
    completed: true,
    muscleGroups: ["Legs"]
  }
];

export const seedSchedules: TaskSchedule[] = [
  { id: "workout", eventType: "workout", weekdays: [1, 3, 5], intervalWeeks: 1, enabled: true, anchorDate: date(60) },
  { id: "measurements", eventType: "measurements", weekdays: [0], intervalWeeks: 1, enabled: true, anchorDate: date(60) },
  { id: "progress", eventType: "progress_photo", weekdays: [6], intervalWeeks: 1, enabled: true, anchorDate: date(60) },
  { id: "inbody", eventType: "inbody", weekdays: [6], intervalWeeks: 4, enabled: true, anchorDate: date(60) }
];

