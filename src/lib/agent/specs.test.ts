import { describe, expect, it } from "vitest";
import { buildOpenApi } from "./openapi";
import { parseRange } from "./range";
import { allSpecs } from "./specs";

describe("tool spec registry", () => {
  it("uses unique names that are valid WebMCP tool names (1-128 chars of [A-Za-z0-9_.-])", () => {
    const names = allSpecs.map((spec) => spec.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[A-Za-z0-9_.-]{1,128}$/);
  });

  it("describes every tool and marks destructive tools", () => {
    for (const spec of allSpecs) {
      expect(spec.description.length).toBeGreaterThan(30);
      expect(spec.title.length).toBeGreaterThan(0);
    }
    const byName = Object.fromEntries(allSpecs.map((spec) => [spec.name, spec]));
    for (const name of ["delete_workout_template", "delete_workout_session"]) {
      expect(byName[name].annotations.destructiveHint).toBe(true);
    }
    expect(byName.get_template.annotations.readOnlyHint).toBe(true);
  });

  it("only maps path and query fields that exist in the input schema", () => {
    for (const spec of allSpecs) {
      if (!spec.rest) continue;
      const fields = Object.keys(spec.input.shape);
      for (const [, name] of spec.rest.path.matchAll(/\{(\w+)\}/g)) expect(fields, `${spec.name} path {${name}}`).toContain(name);
      for (const name of spec.rest.query ?? []) expect(fields, `${spec.name} query ${name}`).toContain(name);
    }
  });
});

describe("OpenAPI document", () => {
  const doc = buildOpenApi("https://form.test");

  it("exposes mapped tools as operations with path, query and body parameters", () => {
    const paths = doc.paths as Record<string, Record<string, { operationId: string; parameters: Array<{ name: string; in: string }>; requestBody?: unknown }>>;
    const getTemplate = paths["/api/templates/{id}"].get;
    expect(getTemplate.operationId).toBe("get_template");
    expect(getTemplate.parameters).toContainEqual(expect.objectContaining({ name: "id", in: "path" }));

    const sessions = paths["/api/workouts"].get;
    expect(sessions.parameters.map((parameter) => parameter.name)).toEqual(expect.arrayContaining(["limit", "from", "to"]));

    const preview = paths["/api/templates/preview-volume"].post;
    expect(preview.requestBody).toBeDefined();
  });

  it("documents the REST body, not the MCP wrapper, for upsert tools", () => {
    const paths = doc.paths as Record<string, Record<string, { requestBody: { content: { "application/json": { schema: { properties: Record<string, unknown> } } } } }>>;
    const exercise = paths["/api/exercises"].post.requestBody.content["application/json"].schema;
    expect(exercise.properties).toHaveProperty("name");
    expect(exercise.properties).not.toHaveProperty("exercise");
    const template = paths["/api/templates"].post.requestBody.content["application/json"].schema;
    expect(template.properties).toHaveProperty("exercises");
    expect(template.properties).not.toHaveProperty("template");
  });
});

describe("parseRange", () => {
  it("treats bare dates as whole UTC days and rejects bad input", () => {
    expect(parseRange("2026-10-01", "2026-10-03")).toEqual({ from: new Date("2026-10-01T00:00:00.000Z"), to: new Date("2026-10-03T23:59:59.999Z") });
    expect(parseRange("2026-10-05T10:00:00Z", undefined)).toEqual({ from: new Date("2026-10-05T10:00:00Z") });
    expect(parseRange("nonsense")).toEqual({ error: "invalid_date_range" });
    expect(parseRange("2026-10-05", "2026-10-01")).toEqual({ error: "invalid_date_range" });
    expect(parseRange()).toEqual({});
  });

  it("rejects impossible calendar days and non-ISO strings instead of shifting the window", () => {
    expect(parseRange("2026-02-31")).toEqual({ error: "invalid_date_range" });
    expect(parseRange("2026-13-01")).toEqual({ error: "invalid_date_range" });
    expect(parseRange("October 1, 2026")).toEqual({ error: "invalid_date_range" });
    expect(parseRange("2026-10-01T10:00:00")).toEqual({ from: new Date("2026-10-01T10:00:00Z") });
    expect(parseRange("2026-10-01T10:00:00+02:00")).toEqual({ from: new Date("2026-10-01T08:00:00Z") });
  });
});
