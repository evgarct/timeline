import { auth } from "@/lib/auth/server";

function unavailable() {
  return Response.json({ error: "Neon Auth is not configured" }, { status: 503 });
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  if (!auth) return unavailable();
  const handlers = auth.handler();
  return handlers.GET(request, context);
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  if (!auth) return unavailable();
  const handlers = auth.handler();
  return handlers.POST(request, context);
}
