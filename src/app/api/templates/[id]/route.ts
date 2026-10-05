import { deleteTemplate, getTemplate, upsertTemplate } from "@/data/workout-template-repository";
import { workoutTemplateInputSchema } from "@/domain/workout-templates";
import { getCurrentUserId } from "@/lib/current-user";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const template = await getTemplate(userId, (await params).id);
  return template ? Response.json(template) : Response.json({ error: "not_found" }, { status: 404 });
}

// Full replace of the template (same shape as POST); also the way to archive/unarchive.
export async function PUT(request: Request, { params }: Context) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const id = (await params).id;
  if (!(await getTemplate(userId, id))) return Response.json({ error: "not_found" }, { status: 404 });
  const parsed = workoutTemplateInputSchema.safeParse({ ...(await request.json().catch(() => ({}))), id });
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    return Response.json(await upsertTemplate(userId, parsed.data));
  } catch (error) {
    const message = error instanceof Error ? error.message : "template_save_failed";
    return Response.json({ error: message }, { status: message === "unknown_exercise" ? 422 : 400 });
  }
}

export async function DELETE(_: Request, { params }: Context) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  return (await deleteTemplate(userId, (await params).id))
    ? new Response(null, { status: 204 })
    : Response.json({ error: "not_found" }, { status: 404 });
}
