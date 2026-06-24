import { expect, test } from "@playwright/test";

test("Today renders the photo as a fullscreen background layer", async ({ page }) => {
  await page.goto("/ru/today", { waitUntil: "domcontentloaded" });

  const background = page.getByTestId("today-photo-background");
  const surface = page.getByTestId("today-photo-surface");

  await expect(background).toBeVisible();
  await expect(surface).toBeVisible();
  await expect(surface.locator("img")).toHaveCount(0);

  const geometry = await page.evaluate(() => {
    const background = document.querySelector<HTMLElement>('[data-testid="today-photo-background"]');
    const title = document.querySelector<HTMLElement>('[data-testid="today-title-overlay"] h1');
    const sheet = document.querySelector<HTMLElement>('[data-testid="today-action-sheet"]');
    if (!background || !title || !sheet) throw new Error("missing Today elements");
    const rect = (element: HTMLElement) => {
      const value = element.getBoundingClientRect();
      return {
        top: value.top,
        bottom: value.bottom,
        left: value.left,
        right: value.right,
        width: value.width,
        height: value.height
      };
    };
    const backgroundStyle = getComputedStyle(background);
    const sheetStyle = getComputedStyle(sheet);
    const titleStyle = getComputedStyle(title);
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      background: rect(background),
      sheet: rect(sheet),
      backgroundImage: backgroundStyle.backgroundImage,
      backgroundPosition: backgroundStyle.backgroundPosition,
      sheetBackground: sheetStyle.backgroundColor,
      sheetBackdrop: sheetStyle.backdropFilter,
      titleFontSize: titleStyle.fontSize
    };
  });

  expect(geometry.background.top).toBeLessThanOrEqual(0);
  expect(geometry.background.bottom).toBeGreaterThanOrEqual(geometry.viewport.height);
  expect(geometry.backgroundImage).toContain("progress-front.png");
  expect(geometry.backgroundPosition).toBe("35% 50%");
  expect(geometry.sheet.top).toBeLessThan(geometry.viewport.height);
  expect(geometry.background.bottom).toBeGreaterThan(geometry.sheet.top);
  expect(geometry.sheetBackground).toMatch(/\/ 0\.(6|7)/);
  expect(geometry.sheetBackdrop).toContain("blur");
  expect(geometry.titleFontSize).toBe("43px");
});

test("progress upload from the Today bottom sheet updates the photo background", async ({ page }) => {
  const uploadedBodies: Buffer[] = [];
  const uploadContentTypes: string[] = [];
  const presignBodies: Array<{ full: { size: number }; thumbnail: { size: number } }> = [];
  let savedAssetId: string | undefined;

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
    savedAssetId = event.photos[0].assetId;
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
          url: "/demo/progress-side.png",
          thumbnailUrl: "/demo/progress-side.png"
        }))
      })
    });
  });

  await page.goto("/ru/today", { waitUntil: "domcontentloaded" });
  await page.getByTestId("today-action-progress_photo").click();
  await page.getByTestId("event-file-input").setInputFiles("public/demo/progress-front.png");
  await page.getByTestId("event-save-button").click();

  await expect.poll(() => uploadedBodies.length).toBe(2);
  await expect(page.getByTestId("event-save-button")).toHaveCount(0);
  await expect.poll(async () => (
    await page.getByTestId("today-photo-background").evaluate((element) => getComputedStyle(element).backgroundImage)
  )).toContain("progress-side.png");

  expect(savedAssetId).toBe("73e167ac-67fe-4ffa-9ad3-4beee18a0e8a");
  expect(uploadContentTypes).toEqual(["image/jpeg", "image/jpeg"]);
  expect(presignBodies).toHaveLength(1);
  expect(presignBodies[0].full.size).toBeGreaterThan(0);
  expect(presignBodies[0].thumbnail.size).toBeGreaterThan(0);
  for (const body of uploadedBodies) {
    if (body.length) expect([...body.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  }
});
