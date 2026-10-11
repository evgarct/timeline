import { studioSpecs } from "@/lib/agent/studio-specs";
import { ToolError, toWebMcpTool, type WebMcpTool } from "@/lib/webmcp/model-context";
import { agentStore } from "./agent-store";

export interface DashboardToolDeps {
  /** Everything the human currently sees on the dashboard. */
  getView: () => Record<string, unknown>;
  selectWeek: (weekStart: string) => boolean;
  selectExercise: (exerciseId: string) => boolean;
}

/** WebMCP tools for the dashboard: read exactly what is on screen, and change what is selected. */
export function dashboardTools(deps: DashboardToolDeps): WebMcpTool[] {
  return [
    toWebMcpTool(studioSpecs.dashboard_get_view, async () => deps.getView()),
    toWebMcpTool(studioSpecs.dashboard_select_week, async ({ weekStart }) => {
      if (!deps.selectWeek(String(weekStart))) throw new ToolError("week_not_found", "That week is not shown; use a weekStart from dashboard_get_view.");
      agentStore.record("dashboard_select_week", String(weekStart));
      // The selection is applied on the next render, so a view read now would still show the old week.
      return { ok: true, selectedWeek: String(weekStart), note: "Call dashboard_get_view to read the updated numbers." };
    }),
    toWebMcpTool(studioSpecs.dashboard_select_exercise, async ({ exerciseId }) => {
      if (!deps.selectExercise(String(exerciseId))) throw new ToolError("exercise_not_available", "The user has not logged that exercise; see exercisesAvailable in dashboard_get_view.");
      agentStore.record("dashboard_select_exercise", String(exerciseId));
      return { ok: true, selectedExerciseId: String(exerciseId), note: "Call dashboard_get_view to read the updated chart." };
    })
  ];
}
