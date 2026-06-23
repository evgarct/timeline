import { expect, test } from "@playwright/test";

test("landing opens sign in and reaches Today", async ({ page }) => {
  await page.goto("/ru");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("история формы");
  await page.getByRole("button", { name: "Начать" }).click();
  await page.getByLabel("Email").fill("demo@example.com");
  await page.getByRole("button", { name: "Продолжить" }).click();
  await expect(page).toHaveURL(/\/ru\/today$/);
  await expect(page.getByRole("button", { name: /Новая фотосессия/ })).toBeVisible();
});

test("Today starts as a photo screen and continues into Timeline", async ({ page }) => {
  await page.goto("/ru/today", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Открыть фото" })).toBeVisible();
  await expect(page.getByText("Timeline")).not.toBeInViewport();

  await page.getByRole("button", { name: "Открыть меню" }).click();
  await page.getByRole("menuitem", { name: "Лендинг" }).click();
  await expect(page).toHaveURL(/\/ru$/);

  await page.goto("/ru/today", { waitUntil: "domcontentloaded" });
  await page.locator("#timeline").scrollIntoViewIfNeeded();
  await expect(page.locator("#timeline")).toBeInViewport();
  await page.locator('a[href="/ru/events/90d785fe-aeb1-43ac-8531-af67d5234b89"]').first().click();
  await expect(page.getByRole("heading", { name: "Новая фотосессия" })).toBeVisible();
});

test("Today photo switches angles and opens the lightbox", async ({ page }) => {
  await page.goto("/ru/today", { waitUntil: "domcontentloaded" });
  const photo = page.getByRole("button", { name: "Открыть фото" });
  await expect(photo.getByAltText("Front progress view")).toBeVisible();
  await page.getByRole("button", { name: "Листать ракурсы 2" }).click();
  await expect(photo.getByAltText("Side progress view")).toBeVisible();

  await photo.click();
  await expect(page.locator(".pswp")).toHaveClass(/pswp--open/);
  await expect(page.locator(".pswp__button--close")).toBeVisible();
});

test("Today context reveals body data only after action", async ({ page }) => {
  await page.goto("/ru/today", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("body-data-panel")).not.toBeVisible();
  await page.getByRole("button", { name: "Данные тела" }).click();
  await expect(page.getByTestId("body-data-panel")).toBeVisible();
  await expect(page.getByTestId("body-data-panel").getByText("Вес")).toBeVisible();
  await expect(page.getByTestId("body-data-panel").getByText("Талия")).toBeVisible();
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
  await page.getByRole("button", { name: /Новая фотосессия/ }).click();
  await page.locator('input[type="file"][multiple]').setInputFiles("public/demo/progress-front.png");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect.poll(() => uploadedBodies.length).toBe(2);
  expect(uploadedBodies).toHaveLength(2);
  expect(uploadContentTypes).toEqual(["image/jpeg", "image/jpeg"]);
  expect(presignBodies).toHaveLength(1);
  expect(presignBodies[0].full.size).toBeGreaterThan(0);
  expect(presignBodies[0].thumbnail.size).toBeGreaterThan(0);
  for (const body of uploadedBodies) {
    if (body.length) expect([...body.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  }
});
