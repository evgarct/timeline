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

// The dev server compiles a route on its first request and can reload modules, wiping the in-memory demo data.
// The navigation badge calls /api/feedback, so warm it up before any test seeds data.
test.beforeEach(async ({ request }) => {
  await request.get("/api/feedback");
});

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
  await expect(page).toHaveURL(/\/ru\/studio\/templates\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  // The editor reloads the template from the API, which proves it persisted (and warms the routes the check below hits).
  await expect(page.getByLabel("Название тренировки")).toHaveValue("E2E Push");

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

test("exercise detail shows technique and video; the catalog folds away and the choice sticks", async ({ page, request }) => {
  const created = await request.post("/api/exercises", {
    data: {
      name: "Studio Detail Row", primaryMuscles: ["lats"], equipment: "cable", movementPattern: "pull",
      instructions: ["Шаг первый: сядь ровно.", "Шаг второй: потяни рукоять."], videoUrl: "https://youtu.be/dQw4w9WgXcQ"
    }
  });
  expect(created.ok()).toBe(true);
  await page.goto("/ru/studio/templates/new", { waitUntil: "domcontentloaded" });
  await searchCatalog(page, "Studio Detail");

  await page.getByRole("button", { name: "Подробнее об упражнении: Studio Detail Row" }).click();
  const dialog = page.getByRole("dialog", { name: "Studio Detail Row" });
  await expect(dialog.getByText("Шаг первый: сядь ровно.")).toBeVisible();
  // The player is a facade: no iframe until play is pressed.
  await expect(dialog.locator("iframe")).toHaveCount(0);
  await dialog.getByRole("button", { name: /Смотреть видео/ }).click();
  await expect(dialog.locator("iframe")).toHaveAttribute("src", /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // Folding the catalog hides the search; the choice survives a reload.
  const catalog = page.getByRole("region", { name: "Каталог" });
  await page.getByRole("button", { name: "Свернуть каталог" }).click();
  await expect(catalog).toHaveAttribute("data-catalog-open", "false");
  await expect(page.getByLabel("Найти упражнение")).toBeHidden();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("region", { name: "Каталог" })).toHaveAttribute("data-catalog-open", "false");
  await page.getByRole("button", { name: "Показать каталог" }).first().click();
  await expect(page.getByLabel("Найти упражнение")).toBeVisible();
});

test("the template editor links back to the list and offers other templates", async ({ page }) => {
  await page.goto("/ru/studio/templates/new", { waitUntil: "domcontentloaded" });
  const nav = page.getByRole("navigation", { name: "Шаблоны" });
  await expect(nav.getByRole("link", { name: "Шаблоны" })).toHaveAttribute("href", "/ru/studio/templates");
  await nav.getByRole("button", { name: "Другой шаблон" }).click();
  await expect(page.getByRole("menuitem", { name: "Новый шаблон" })).toBeVisible();
});
