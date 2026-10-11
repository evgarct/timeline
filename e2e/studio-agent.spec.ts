import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Stands in for a WebMCP-capable browser: records registered tools and lets the test call them like an agent would.
async function installFakeModelContext(page: Page) {
  await page.addInitScript(() => {
    const tools = new Map<string, { execute: (input: Record<string, unknown>) => Promise<unknown> }>();
    (document as unknown as { modelContext: unknown }).modelContext = {
      registerTool(tool: { name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }, options?: { signal?: AbortSignal }) {
        if (tools.has(tool.name)) throw new Error(`duplicate tool ${tool.name}`);
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

const tools = (page: Page) => page.evaluate(() => (window as unknown as { __agent: { names: () => string[] } }).__agent.names());
const callTool = (page: Page, name: string, input: Record<string, unknown> = {}) =>
  page.evaluate(([toolName, toolInput]) => (window as unknown as { __agent: { call: (n: string, i: unknown) => Promise<unknown> } }).__agent.call(toolName as string, toolInput), [name, input] as const) as Promise<Record<string, unknown>>;

async function createExercise(request: APIRequestContext, name: string, primary: string) {
  const response = await request.post("/api/exercises", { data: { name, primaryMuscles: [primary], equipment: "barbell", movementPattern: "push" } });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { id: string }).id;
}

test("a copilot builds and saves a template through WebMCP while the human watches", async ({ page, request }) => {
  const bench = await createExercise(request, "Agent E2E Bench", "chest");
  const press = await createExercise(request, "Agent E2E Press", "shoulders");
  await installFakeModelContext(page);
  await page.goto("/ru/studio/templates/new", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (window as unknown as { __agent: { names: () => string[] } }).__agent.names().includes("builder_save"));

  await callTool(page, "builder_set_name", { name: "Agent E2E Push" });
  await callTool(page, "builder_add_exercise", { exerciseId: bench });
  const second = await callTool(page, "builder_add_exercise", { exerciseId: press }) as { draft: { items: Array<{ key: string }> } };
  const [first] = second.draft.items;
  await callTool(page, "builder_update_exercise", { itemKey: first.key, sets: 4, repMin: 6, repMax: 8, weightKg: 80 });
  await callTool(page, "builder_link_superset", { itemKey: first.key, linked: true });

  // The page shows what the agent did: the cards, the chip and a highlight.
  await expect(page.locator("[data-card]")).toHaveCount(2);
  await expect(page.getByTestId("agent-chip")).toBeVisible();
  await expect(page.getByText("Суперсет").first()).toBeVisible();
  await expect(page.getByLabel("Название тренировки")).toHaveValue("Agent E2E Push");

  // Saving is consequential: the human has to approve it.
  const saving = callTool(page, "builder_save");
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Agent E2E Push");
  await dialog.getByRole("button", { name: "Разрешить" }).click();
  expect(await saving).toMatchObject({ ok: true });
  await expect(page).toHaveURL(/\/ru\/studio\/templates\/[0-9a-f-]{36}$/);

  const saved = await (await request.get("/api/templates")).json() as { items: Array<{ name: string; exercises: Array<{ sets: number; groupId?: string }> }> };
  const template = saved.items.find((item) => item.name === "Agent E2E Push");
  expect(template?.exercises[0]).toMatchObject({ sets: 4 });
  expect(template?.exercises[0].groupId).toBeTruthy();
  expect(template?.exercises[0].groupId).toBe(template?.exercises[1].groupId);
});

test("declining the approval dialog keeps the draft unsaved", async ({ page, request }) => {
  const bench = await createExercise(request, "Agent E2E Decline", "chest");
  await installFakeModelContext(page);
  await page.goto("/ru/studio/templates/new", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (window as unknown as { __agent: { names: () => string[] } }).__agent.names().includes("builder_save"));
  await callTool(page, "builder_set_name", { name: "Agent E2E Declined" });
  await callTool(page, "builder_add_exercise", { exerciseId: bench });

  const saving = callTool(page, "builder_save");
  await page.getByRole("alertdialog").getByRole("button", { name: "Отклонить" }).click();
  expect(await saving).toMatchObject({ ok: false, error: "user_declined" });
  await expect(page).toHaveURL(/\/templates\/new$/);
  const saved = await (await request.get("/api/templates")).json() as { items: Array<{ name: string }> };
  expect(saved.items.some((item) => item.name === "Agent E2E Declined")).toBe(false);
});

test("tools follow the page: builder tools only on the builder, dashboard tools only on the dashboard", async ({ page }) => {
  await installFakeModelContext(page);
  await page.goto("/ru/studio", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (window as unknown as { __agent: { names: () => string[] } }).__agent.names().includes("dashboard_get_view"));
  const onDashboard = await tools(page);
  expect(onDashboard).toEqual(expect.arrayContaining(["studio_get_context", "studio_navigate", "search_exercises", "list_workout_templates", "dashboard_select_week"]));
  expect(onDashboard).not.toContain("builder_get_draft");
  expect(await callTool(page, "studio_get_context")).toMatchObject({ page: "dashboard", locale: "ru" });

  const navigated = await callTool(page, "studio_navigate", { to: "new_template" });
  expect(navigated).toMatchObject({ ok: true });
  await page.waitForFunction(() => (window as unknown as { __agent: { names: () => string[] } }).__agent.names().includes("builder_get_draft"));
  const onBuilder = await tools(page);
  expect(onBuilder).not.toContain("dashboard_get_view");
  expect(onBuilder).toContain("studio_get_context");
});

test("without WebMCP the page works and shows no agent chip", async ({ page }) => {
  await page.goto("/ru/studio/templates/new", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Название тренировки")).toBeVisible();
  await expect(page.getByTestId("agent-chip")).toHaveCount(0);
});
