import { expect, test } from "@playwright/test";

// Demo mode seeds two fabricated InBody sheets (never real reports): a start and a later one.
const latestId = "7e5839e1-0274-4969-be96-a96e407fd9bf";

test.beforeEach(async ({ request }) => {
  await request.get("/api/events");
});

test("the event page shows every section of the sheet with changes and ranges", async ({ page }) => {
  await page.goto(`/ru/events/${latestId}`, { waitUntil: "domcontentloaded" });
  const report = page.getByTestId("inbody-report");
  await expect(report).toBeVisible();

  await expect(page.getByTestId("inbody-headline-weight")).toContainText("76,1");
  // the change since the previous (fabricated) test: 75.0 -> 76.1
  await expect(page.getByTestId("inbody-headline-weight")).toContainText("+1,1");
  for (const section of ["composition", "obesity", "control", "research", "segmental_lean", "segmental_fat", "impedance"]) {
    await expect(page.getByTestId(`inbody-section-${section}`)).toBeVisible();
  }
  await expect(page.getByTestId("inbody-lean-trunk")).toContainText("29,6");
  await expect(page.getByTestId("inbody-metric-weight")).toContainText("Норма 60,2–81,4");
  await expect(page.getByTestId("inbody-open-original")).toHaveAttribute("href", /inbody-sample\.jpg/);

  // the exercise table folds away until asked for
  await expect(page.getByTestId("inbody-section-exercise").locator("dl")).toBeHidden();
  await page.getByTestId("inbody-section-exercise").locator("summary").click();
  await expect(page.getByTestId("inbody-section-exercise").locator("dl")).toBeVisible();
});

test("the Today timeline row names the headline numbers", async ({ page }) => {
  await page.goto("/ru/today", { waitUntil: "domcontentloaded" });
  const row = page.locator(`a[href$="/events/${latestId}"]`);
  await expect(row).toContainText("InBody");
  await expect(row).toContainText("Вес 76.1 kg");
});

test("Studio Body shows the trend, the tests and what happened between them", async ({ page }) => {
  await page.goto("/ru/studio/body", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("body-trend")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("body-change")).toContainText("1,1");
  await expect(page.getByRole("button", { name: "Процент жира" })).toBeVisible();
  await page.getByRole("button", { name: "Процент жира" }).click();
  await expect(page.getByTestId("body-change")).toContainText("1,8");
  await expect(page.getByTestId(`body-test-${latestId}`)).toBeVisible();
  await expect(page.getByTestId(`body-interval-${latestId}`)).toContainText("Между тестами");
});

test("the Body API returns the tests with deltas", async ({ request }) => {
  const response = await request.get("/api/body/inbody?timezone=Europe/Prague");
  expect(response.ok()).toBe(true);
  const { tests } = await response.json() as { tests: Array<{ id: string; metrics: Array<{ key: string; deltaFromPrevious?: number }> }> };
  expect(tests.length).toBeGreaterThanOrEqual(2);
  const latest = tests.find((test) => test.id === latestId);
  expect(latest?.metrics.find((metric) => metric.key === "weight")?.deltaFromPrevious).toBe(1.1);
  expect((await request.get("/api/body/inbody?timezone=Nope/Zone")).status()).toBe(400);
});
