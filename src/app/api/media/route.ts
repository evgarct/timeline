import { get } from "@vercel/blob";
import { getCurrentUserId } from "@/lib/current-user";

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const pathname = new URL(request.url).searchParams.get("pathname");
  if (!pathname?.startsWith(`users/${userId}/`)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const blob = await get(pathname, { access: "private" });
  if (!blob) return Response.json({ error: "Not found" }, { status: 404 });
  const headers = new Headers();
  blob.headers.forEach((value, key) => headers.set(key, value));
  return new Response(blob.stream, { headers });
}
