import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateMcp, createTimelineMcpServer } from "@/mcp/server";
import { corsPreflight, withCors } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  const userId = await authenticateMcp(request);
  if (!userId) {
    const origin = new URL(request.url).origin;
    return withCors(
      request,
      Response.json(
        { error: "Invalid or missing bearer token" },
        {
          status: 401,
          headers: {
            "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`
          }
        }
      )
    );
  }
  const server = createTimelineMcpServer(userId);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });
  await server.connect(transport);
  return withCors(request, await transport.handleRequest(request));
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
export const OPTIONS = corsPreflight;

