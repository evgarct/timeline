import { expect, test } from "@playwright/test";

test("landing opens sign in and reaches Today", async ({ page }) => {
  await page.goto("/ru");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("история формы");
  await page.getByRole("button", { name: "Начать" }).click();
  await page.getByLabel("Email").fill("demo@example.com");
  await page.getByRole("button", { name: "Продолжить" }).click();
  await expect(page).toHaveURL(/\/ru\/today$/);
  await expect(page.getByText("Задачи на сегодня")).toBeVisible();
});

test("Today continues into Timeline and opens an event", async ({ page }) => {
  await page.goto("/ru/today");
  await page.locator("#timeline").scrollIntoViewIfNeeded();
  await expect(page.locator("#timeline")).toBeVisible();
  await page.getByRole("link", { name: /Фото прогресса/ }).first().click();
  await expect(page.getByRole("heading", { name: "Фото прогресса" })).toBeVisible();
});

