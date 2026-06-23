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
  await page.goto("/ru/today", { waitUntil: "domcontentloaded" });
  await page.locator('a[href="/ru"]').first().click();
  await expect(page).toHaveURL(/\/ru$/);
  await page.goto("/ru/today", { waitUntil: "domcontentloaded" });
  await page.locator("#timeline").scrollIntoViewIfNeeded();
  await expect(page.locator("#timeline")).toBeVisible();
  const progressLinks = page.locator('a[href="/ru/events/90d785fe-aeb1-43ac-8531-af67d5234b89"]');
  await expect(progressLinks).toHaveCount(2);
  await progressLinks.nth(1).click();
  await expect(page.getByRole("heading", { name: "Фото прогресса" })).toBeVisible();
});

test("progress photos open in a touch-friendly lightbox", async ({ page }) => {
  await page.goto("/ru/events/90d785fe-aeb1-43ac-8531-af67d5234b89");
  await page.getByRole("link", { name: /Открыть галерею: Front progress view/ }).click();
  await expect(page.locator(".pswp")).toHaveClass(/pswp--open/);
  await expect(page.locator(".pswp__button--close")).toBeVisible();
});

test("progress upload normalizes an image and persists managed asset references", async ({ page }) => {
  const uploadedBodies: Buffer[] = [];
  const uploadContentTypes: string[] = [];
  const presignBodies: Array<{ full: { size: number }; thumbnail: { size: number } }> = [];
  await page.route("**/api/uploads/presign", async (route) => {
    presignBodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        assetId: "73e167ac-67fe-4ffa-9ad3-4beee18a0e8a",
        uploads: [
          { role: "full", url: "http://127.0.0.1:3100/mock-upload/full", contentType: "image/jpeg" },
          { role: "thumbnail", url: "http://127.0.0.1:3100/mock-upload/thumbnail", contentType: "image/jpeg" }
        ]
      })
    });
  });
  await page.route("**/mock-upload/**", async (route) => {
    uploadedBodies.push(route.request().postDataBuffer() ?? Buffer.alloc(0));
    uploadContentTypes.push(route.request().headers()["content-type"] ?? "");
    await route.fulfill({ status: 200 });
  });
  await page.route("**/api/uploads/complete", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ assetId: "73e167ac-67fe-4ffa-9ad3-4beee18a0e8a", status: "ready" })
    });
  });
  await page.route("**/api/events", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const event = route.request().postDataJSON();
    expect(event.photos[0]).toMatchObject({
      assetId: "73e167ac-67fe-4ffa-9ad3-4beee18a0e8a",
      palette: expect.objectContaining({
        background: expect.stringMatching(/^#[0-9a-f]{6}$/i),
        accent: expect.stringMatching(/^#[0-9a-f]{6}$/i),
        foreground: expect.stringMatching(/^#[0-9a-f]{6}$/i)
      })
    });
    expect(event.photos[0].url).toBeUndefined();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        ...event,
        photos: event.photos.map((photo: object) => ({
          ...photo,
          url: "/demo/progress-front.png",
          thumbnailUrl: "/demo/progress-front.png"
        }))
      })
    });
  });

  await page.goto("/ru/today");
  await page.getByRole("button", { name: /Фото прогресса/ }).click();
  await page.locator('input[type="file"][multiple]').setInputFiles("public/demo/progress-front.png");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("Выполнено")).toBeVisible();
  expect(uploadedBodies).toHaveLength(2);
  expect(uploadContentTypes).toEqual(["image/jpeg", "image/jpeg"]);
  expect(presignBodies).toHaveLength(1);
  expect(presignBodies[0].full.size).toBeGreaterThan(0);
  expect(presignBodies[0].thumbnail.size).toBeGreaterThan(0);
  for (const body of uploadedBodies) {
    if (body.length) expect([...body.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  }
});
