import { z } from "zod";
import { previewTemplateVolume } from "@/data/exercise-repository";
import { getCurrentUserId } from "@/lib/current-user";

const bodySchema = z.object({
  exercises: z.array(z.object({ exerciseId: z.string().uuid(), sets: z.number().int().min(1).max(20) })).min(1).max(30)
});

// Sets per muscle for an unsaved plan (primary 1, secondary 0.5 per set). Nothing is written.
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const preview = await previewTemplateVolume(userId, parsed.data.exercises);
  return preview.missing.length ? Response.json({ error: "unknown_exercise", missing: preview.missing }, { status: 422 }) : Response.json(preview);
}
