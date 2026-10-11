import { expect, test, type Page } from "@playwright/test";

// Stands in for a WebMCP-capable browser: records registered tools and lets the test call them like an agent would.
async function installFakeModelContext(page: Page) {
  await page.addInitScript(() => {
    const tools = new Map<string, { execute: (input: Record<string, unknown>) => Promise<unknown> }>();
    (document as unknown as { modelContext: unknown }).modelContext = {
      registerTool(tool: { name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }, options?: { signal?: AbortSignal }) {
        tools.set(tool.name, tool);
        options?.signal?.addEventListener("abort", () => tools.delete(tool.name));
      }
    };
    (window as unknown as { __agent: unknown }).__agent = {
      names: () => [...tools.keys()],
      call: (name: string, input: Record<string, unknown> = {}) => tools.get(name)?.execute(input)
    };
  });
}

const callTool = (page: Page, name: string, input: Record<string, unknown> = {}) =>
  page.evaluate(([toolName, toolInput]) => (window as unknown as { __agent: { call: (n: string, i: unknown) => Promise<unknown> } }).__agent.call(toolName as string, toolInput), [name, input] as const) as Promise<Record<string, unknown>>;

test("an agent leaves feedback through WebMCP and the owner triages it in the inbox", async ({ page }) => {
  await installFakeModelContext(page);
  // Let the navigation badge's first request finish, so the agent's write is not racing the initial load.
  const firstBadgeLoad = page.waitForResponse((response) => response.url().includes("/api/feedback?") && response.request().method() === "GET");
  await page.goto("/ru/studio", { waitUntil: "domcontentloaded" });
  await firstBadgeLoad;
  await page.waitForFunction(() => (window as unknown as { __agent: { names: () => string[] } }).__agent.names().includes("send_feedback"));

  const sent = await callTool(page, "send_feedback", {
    category: "friction", severity: "medium", tool: "dashboard_select_week", summary: "E2E: select_week should return the new KPIs",
    details: "I had to call dashboard_get_view after every selection.", expected: "The updated numbers in the same response.",
    suggestion: "Return the derived view."
  });
  expect(sent).toMatchObject({ category: "friction", status: "new", source: "webmcp", duplicate: false });
  expect(String(sent.page)).toContain("/ru/studio");

  // The navigation badge counts untriaged entries.
  await expect(page.getByTestId("feedback-badge").first()).toBeVisible();

  await page.getByRole("link", { name: /Фидбек/ }).click();
  const entry = page.getByTestId("feedback-entry").filter({ hasText: "E2E: select_week should return the new KPIs" });
  await expect(entry).toBeVisible();
  await expect(entry).toContainText("Return the derived view.");
  await expect(entry).toContainText("WebMCP");

  await entry.getByRole("button", { name: "Разбираем" }).click();
  await expect(entry.getByRole("button", { name: "Разбираем" })).toHaveAttribute("aria-pressed", "true");
  await entry.getByLabel("Заметка о решении").fill("Planned for the next release");
  await entry.getByLabel("Заметка о решении").blur();

  // The agent can read the triage back with the same tools.
  const listed = await callTool(page, "list_feedback", { status: "triaged" }) as { items: Array<{ summary: string; resolution?: string }> };
  expect(listed.items.find((item) => item.summary.startsWith("E2E: select_week"))?.resolution).toBe("Planned for the next release");

  // Filtering by status hides entries in other states.
  await page.getByRole("group", { name: "Все статусы" }).getByRole("button", { name: "Сделано" }).click();
  await expect(page.getByTestId("feedback-entry").filter({ hasText: "E2E: select_week" })).toHaveCount(0);
});

test("the feedback inbox page renders", async ({ page }) => {
  await page.goto("/ru/studio/feedback", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Фидбек агентов" })).toBeVisible();
});
