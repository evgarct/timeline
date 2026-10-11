/**
 * The dev server compiles each route on its first request and can reload modules while doing so, which wipes the
 * in-memory demo data of E2E_DEMO_MODE. Touching every route once before the first test makes the specs
 * deterministic (a test never seeds data and then triggers a first-time compile in the middle of its own flow).
 */
const base = "http://127.0.0.1:3100";
const id = "00000000-0000-4000-8000-000000000000";

const pages = ["/ru", "/ru/today", "/ru/studio", "/ru/studio/templates", "/ru/studio/templates/new", `/ru/studio/templates/${id}`, "/ru/studio/feedback"];
const apis = [
  "/api/events", "/api/exercises", "/api/exercises/facets", `/api/exercises/${id}`, `/api/exercises/${id}/history`, `/api/exercises/${id}/alternatives`,
  "/api/templates", `/api/templates/${id}`, `/api/templates/${id}/plan`, `/api/templates/${id}/duplicate`, "/api/templates/preview-volume",
  "/api/workouts", `/api/workouts/${id}`, "/api/workouts/volume", "/api/feedback", `/api/feedback/${id}`, "/api/openapi.json"
];

export default async function globalSetup() {
  for (const path of [...pages, ...apis]) {
    try {
      await fetch(`${base}${path}`, { redirect: "manual" });
    } catch {
      // A route that cannot be reached is the test's problem to report, not the warm-up's.
    }
  }
}
