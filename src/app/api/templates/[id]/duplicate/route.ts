import { z } from "zod";
import { duplicateTemplate } from "@/data/workout-template-repository";
import { getCurrentUserId } from "@/lib/current-user";

const bodySchema = z.object({ name: z.string().trim().min(1).max(120).optional() });

// Creates a copy under a free name ("X (copy)"); the original is untouched.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const copy = await duplicateTemplate(userId, (await params).id, parsed.data.name);
  return copy ? Response.json(copy, { status: 201 }) : Response.json({ error: "not_found" }, { status: 404 });
}
