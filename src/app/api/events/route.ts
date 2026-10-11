import { createEvent, listEvents } from "@/data/repository";
import { eventTypeSchema, timelineEventSchema } from "@/domain/events";
import { parseRange } from "@/lib/agent/range";
import { getCurrentUserId } from "@/lib/current-user";

// Newest first. Optional filters: type, from/to (ISO 8601 or YYYY-MM-DD), limit (1-500) and offset for paging.
export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const rawType = params.get("type");
  const type = rawType ? eventTypeSchema.safeParse(rawType) : undefined;
  if (type && !type.success) return Response.json({ error: "invalid_type" }, { status: 400 });
  const range = parseRange(params.get("from"), params.get("to"));
  if ("error" in range) return Response.json({ error: range.error }, { status: 400 });
  const rawLimit = params.get("limit");
  const rawOffset = params.get("offset");
  const limit = rawLimit ? Math.min(500, Math.max(1, Number.parseInt(rawLimit, 10) || 1)) : undefined;
  const offset = rawOffset ? Math.max(0, Number.parseInt(rawOffset, 10) || 0) : undefined;

  return Response.json(await listEvents(userId, { type: type?.data, limit, offset, ...range }));
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = timelineEventSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    return Response.json(await createEvent(userId, parsed.data), { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "event_save_failed" }, { status: 400 });
  }
}
