import type { Locale } from "@/i18n/config";
import type { StudioCopy } from "@/i18n/studio-messages";
import { studioSpecs } from "@/lib/agent/studio-specs";
import { restBridgeTools } from "@/lib/webmcp/bridge";
import { ToolError, toWebMcpTool, type WebMcpTool } from "@/lib/webmcp/model-context";
import { agentStore } from "./agent-store";

export interface ShellToolDeps {
  locale: Locale;
  copy: StudioCopy;
  getContext: () => { pathname: string; theme: string; unsavedChanges: boolean };
  navigate: (path: string) => void;
  /** Called after the agent wrote something through a REST tool, so cached lists refresh. */
  onWrite: () => void;
}

export type StudioPage = "dashboard" | "templates" | "new_template" | "template" | "other";

export function pageOf(pathname: string, locale: string): StudioPage {
  const base = `/${locale}/studio`;
  if (pathname === base || pathname === `${base}/`) return "dashboard";
  if (pathname === `${base}/templates`) return "templates";
  if (pathname === `${base}/templates/new`) return "new_template";
  if (pathname.startsWith(`${base}/templates/`)) return "template";
  return "other";
}

/**
 * Tools that exist on every Studio page: where am I, go somewhere, and the REST-bridged data and write tools of the
 * shared registry. Destructive bridged tools ask the human first.
 */
export function shellTools(deps: ShellToolDeps): WebMcpTool[] {
  const { copy, locale } = deps;
  const base = `/${locale}/studio`;

  return [
    toWebMcpTool(studioSpecs.studio_get_context, async () => {
      const context = deps.getContext();
      return { page: pageOf(context.pathname, locale), path: context.pathname, locale, theme: context.theme, unsavedChanges: context.unsavedChanges };
    }),
    toWebMcpTool(studioSpecs.studio_navigate, async ({ to, templateId }) => {
      const path = to === "dashboard" ? base
        : to === "templates" ? `${base}/templates`
          : to === "new_template" ? `${base}/templates/new`
            : templateId ? `${base}/templates/${String(templateId)}` : undefined;
      if (!path) throw new ToolError("template_id_required", "Pass templateId when to is \"template\".");
      if (deps.getContext().unsavedChanges && !(await agentStore.requestConfirm(copy.agent.leaveConfirm))) {
        throw new ToolError("user_declined", "The user declined to leave the page with unsaved changes.");
      }
      deps.navigate(path);
      agentStore.record("studio_navigate", String(to));
      return { ok: true, path };
    }, { consequential: true }),
    ...restBridgeTools({
      // Feedback sent from the page records where it came from; the agent cannot set these fields itself.
      augmentBody: (spec) => (spec.name === "send_feedback" ? { source: "webmcp", page: deps.getContext().pathname } : undefined),
      confirm: (title) => agentStore.requestConfirm(copy.agent.actionConfirm.replace("{action}", title)),
      onWrite: (spec) => {
        agentStore.record(spec.name);
        deps.onWrite();
      }
    })
  ];
}
