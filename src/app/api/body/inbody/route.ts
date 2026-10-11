import { getBodyComposition } from "@/data/body-composition";
import { parseMetricsParam } from "@/domain/body-composition";
import { isValidTimeZone } from "@/domain/exercises";
import { parseRange } from "@/lib/agent/range";
import { getCurrentUserId } from "@/lib/current-user";

// InBody tests oldest first, with the change since the previous test and what happened in between (diet, steps,
// training, progress photos, tape measurements). `metrics` is a comma list of keys or "all" (default: the trend set).
export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const range = parseRange(params.get("from"), params.get("to"));
  if ("error" in range) return Response.json({ error: range.error }, { status: 400 });
  const timezone = params.get("timezone") ?? "UTC";
  if (!isValidTimeZone(timezone)) return Response.json({ error: "invalid_timezone" }, { status: 400 });

  const tests = await getBodyComposition(userId, { ...range, timezone, metrics: parseMetricsParam(params.get("metrics") ?? undefined) });
  return Response.json({ tests });
}
