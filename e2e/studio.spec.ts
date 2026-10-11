import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

async function seedExercises(request: APIRequest) {
  const make = async (name: string, primaryMuscles: string[], secondaryMuscles: string[]) => {
    const response = await request.post("/api/exercises", { data: { name, primaryMuscles, secondaryMuscles, equipment: "barbell", movementPattern: "push" } });
    expect(response.ok()).toBe(true);
    return (await response.json()) as { id: string };
  };
  await make("Studio Bench Press", ["chest"], ["triceps"]);
  await make("Studio Overhead Press", ["shoulders"], ["triceps"]);
}

type APIRequest = APIRequestContext;

/** The catalog search is a controlled input: a fill before hydration is wiped, so retry until it sticks. */
async function searchCatalog(page: Page, text: string) {
  const search = page.getByLabel("Найти упражнение");
  await expect(async () => {
    await search.fill(text);
    await expect(search).toHaveValue(text);
  }).toPass();
}

test("builds a template: search, add, superset, save", async ({ page, request }) => {
  await seedExercises(request);
  await page.goto("/ru/studio/templates/new", { waitUntil: "domcontentloaded" });

  await page.getByLabel("Название тренировки").fill("E2E Push");
  await searchCatalog(page, "Studio");
  await page.getByRole("button", { name: "Добавить: Studio Bench Press" }).click();
  await page.getByRole("button", { name: "Добавить: Studio Overhead Press" }).click();

  // The first card's link button joins it with the next exercise into a superset.
  await page.getByRole("button", { name: "Связать со следующим" }).click();
  await expect(page.getByText("Суперсет").first()).toBeVisible();

  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page).toHaveURL(/\/ru\/studio\/templates\/[0-9a-f-]{36}$/);

  const saved = await (await request.get("/api/templates")).json() as { items: Array<{ name: string; exercises: Array<{ groupId?: string }> }> };
  const template = saved.items.find((item) => item.name === "E2E Push");
  expect(template?.exercises).toHaveLength(2);
  expect(template?.exercises[0].groupId).toBeTruthy();
  expect(template?.exercises[0].groupId).toBe(template?.exercises[1].groupId);
});

test("Studio tokens stay scoped: Today keeps its own background", async ({ page }) => {
  await page.goto("/ru/studio/templates", { waitUntil: "domcontentloaded" });
  const studio = await page.evaluate(() => getComputedStyle(document.querySelector('[data-surface="studio"]') as Element).getPropertyValue("--s-primary").trim());
  expect(studio).not.toBe("");
  await page.goto("/ru/today", { waitUntil: "domcontentloaded" });
  expect(await page.evaluate(() => document.querySelector('[data-surface="studio"]'))).toBeNull();
});

test("creates an exercise from the catalog and adds it to the canvas", async ({ page }) => {
  await page.goto("/ru/studio/templates/new", { waitUntil: "domcontentloaded" });
  await searchCatalog(page, "Zottman Curl E2E");
  await page.getByRole("button", { name: /Создать .Zottman Curl E2E./ }).click();
  await page.getByRole("button", { name: "Бицепс", exact: true }).click();
  await page.getByRole("form", { name: "Новое упражнение" }).getByRole("button", { name: "Создать", exact: true }).click();
  await expect(page.getByRole("button", { name: "Убрать: Zottman Curl E2E" })).toBeVisible();
});

test("dragging a catalog exercise onto the canvas inserts it at the drop position", async ({ page, request }) => {
  await seedExercises(request);
  await page.goto("/ru/studio/templates/new", { waitUntil: "domcontentloaded" });
  await searchCatalog(page, "Studio");
  await page.getByRole("button", { name: "Добавить: Studio Bench Press" }).click();

  const tile = page.getByRole("button", { name: "Добавить: Studio Overhead Press" });
  const firstCard = page.locator("[data-card]").first();
  // Dropping on the upper half of the first card inserts before it.
  await tile.dragTo(firstCard, { targetPosition: { x: 40, y: 8 } });

  await expect(page.locator("[data-card]")).toHaveCount(2);
  await expect(page.locator("[data-card]").first()).toContainText("Studio Overhead Press");
});
