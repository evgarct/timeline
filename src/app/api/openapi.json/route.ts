import { buildOpenApi } from "@/lib/agent/openapi";

// Public: it only describes operations (names, parameters), never data. Generated from the tool spec registry.
export async function GET(request: Request) {
  return Response.json(buildOpenApi(new URL(request.url).origin), { headers: { "cache-control": "public, max-age=300" } });
}
