import { z } from "zod";
import { allSpecs, type ToolSpec } from "./specs";

type JsonSchema = { properties?: Record<string, unknown>; required?: string[] } & Record<string, unknown>;

const pathParams = (path: string) => [...path.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);

/** OpenAPI 3.1 document for every tool that has a REST mapping, generated from the shared spec registry. */
export function buildOpenApi(origin: string, specs: ToolSpec[] = allSpecs) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const spec of specs) {
    if (!spec.rest) continue;
    const schema = z.toJSONSchema(spec.input, { unrepresentable: "any", io: "input" }) as JsonSchema;
    const properties = schema.properties ?? {};
    const required = new Set(schema.required ?? []);
    const inPath = new Set(pathParams(spec.rest.path));
    const inQuery = new Set(spec.rest.query ?? []);
    const hasBody = spec.rest.method === "POST" || spec.rest.method === "PUT" || spec.rest.method === "PATCH";

    const parameters = [
      ...[...inPath].map((name) => ({ name, in: "path", required: true, schema: properties[name] ?? { type: "string" } })),
      ...[...inQuery].map((name) => ({ name, in: "query", required: required.has(name), schema: properties[name] ?? { type: "string" } }))
    ];
    const bodyProperties = Object.fromEntries(Object.entries(properties).filter(([name]) => !inPath.has(name) && !inQuery.has(name)));

    const operation: Record<string, unknown> = {
      operationId: spec.name,
      summary: spec.title,
      description: spec.description,
      parameters,
      responses: { 200: { description: "OK" }, 401: { description: "Not signed in" } },
      "x-readOnly": Boolean(spec.annotations.readOnlyHint),
      "x-destructive": Boolean(spec.annotations.destructiveHint)
    };
    if (hasBody && spec.rest.unwrap) {
      operation.requestBody = { required: true, content: { "application/json": { schema: properties[spec.rest.unwrap] ?? { type: "object" } } } };
    } else if (hasBody && Object.keys(bodyProperties).length) {
      operation.requestBody = {
        required: true,
        content: { "application/json": { schema: { type: "object", properties: bodyProperties, required: [...required].filter((name) => name in bodyProperties) } } }
      };
    }
    const path = spec.rest.path.replace(/\{(\w+)\}/g, "{$1}");
    paths[path] = { ...paths[path], [spec.rest.method.toLowerCase()]: operation };
  }
  return {
    openapi: "3.1.0",
    info: { title: "Form agent API", version: "1.0.0", description: "REST operations that mirror the MCP / WebMCP tools. Authenticated by the signed-in session cookie." },
    servers: [{ url: origin }],
    components: { securitySchemes: { sessionCookie: { type: "apiKey", in: "cookie", name: "better-auth.session_token" } } },
    security: [{ sessionCookie: [] }],
    paths
  };
}
