import { corsPreflight, withCors } from "@/lib/cors";

export const OPTIONS = corsPreflight;

export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return withCors(
    request,
    Response.json({
      resource: `${origin}/api/mcp`,
      authorization_servers: [origin],
      scopes_supported: ["mcp"],
      bearer_methods_supported: ["header"]
    })
  );
}
