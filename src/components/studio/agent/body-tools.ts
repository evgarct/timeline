import { studioSpecs } from "@/lib/agent/studio-specs";
import { ToolError, toWebMcpTool, type WebMcpTool } from "@/lib/webmcp/model-context";
import { agentStore } from "./agent-store";

export interface BodyToolDeps {
  /** Everything the human currently sees on the Body page. */
  getView: () => Record<string, unknown>;
  selectMetric: (key: string) => boolean;
}

/** WebMCP tools for the Body page: read exactly what is on screen, and change the charted metric. */
export function bodyTools(deps: BodyToolDeps): WebMcpTool[] {
  return [
    toWebMcpTool(studioSpecs.body_get_view, async () => deps.getView()),
    toWebMcpTool(studioSpecs.body_select_metric, async ({ key }) => {
      if (!deps.selectMetric(String(key))) throw new ToolError("metric_not_available", "That metric is not on offer; use a key from metricsAvailable in body_get_view.");
      agentStore.record("body_select_metric", String(key));
      // The selection is applied on the next render, so a view read now would still show the old metric.
      return { ok: true, selectedMetric: String(key), note: "Call body_get_view to read the updated chart." };
    })
  ];
}
