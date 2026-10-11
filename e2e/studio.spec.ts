import { expect, test, type APIRequestContext } from "@playwright/test";

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

test("builds a template: search, add, superset, save", async ({ page, request }) => {
  await seedExercises(request);
  await page.goto("/ru/studio/templates/new", { waitUntil: "domcontentloaded" });

  await page.getByLabel("Название тренировки").fill("E2E Push");
  const search = page.getByLabel("Найти упражнение");
  await search.fill("Studio");
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
