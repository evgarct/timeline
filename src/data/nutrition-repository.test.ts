import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ database: null }));

const userId = "nutrition-owner";
const otherUserId = "other-owner";
const productInput = {
  name: "Whole label yoghurt",
  brand: "Form",
  barcode: "8591234567890",
  baseUnit: "g" as const,
  nutrientBases: [{
    id: "per-100-g",
    label: "Per 100 g",
    amount: 100,
    unit: "g" as const,
    nutrients: [
      { key: "energy_kcal", label: "Energy", value: 80, unit: "kcal", provenance: "stated" as const },
      { key: "protein", label: "Protein", value: 9, unit: "g", provenance: "stated" as const },
      { key: "fat", label: "Fat", value: 2, unit: "g", provenance: "stated" as const },
      { key: "carbohydrates", label: "Carbohydrates", value: 6, unit: "g", provenance: "stated" as const },
      { key: "saturated_fat", label: "Saturates", value: 1.3, unit: "g", provenance: "stated" as const },
      { key: "sugars", label: "Sugars", value: 5, unit: "g", provenance: "stated" as const },
      { key: "salt", label: "Salt", value: 0.12, unit: "g", provenance: "stated" as const },
      { key: "sodium", label: "Sodium", value: 48, unit: "mg", provenance: "stated" as const },
      { label: "Culture X", qualifier: "trace" as const, unit: "CFU", originalText: "trace", provenance: "stated" as const }
    ]
  }],
  pieceSizes: []
};

let repository: typeof import("./nutrition-repository");

beforeAll(async () => {
  vi.stubEnv("E2E_DEMO_MODE", "true");
  vi.resetModules();
  repository = await import("./nutrition-repository");
});

describe("memory nutrition repository", () => {
  it("upserts by barcode and keeps products owner-scoped", async () => {
    const created = await repository.upsertProduct(userId, productInput);
    const reused = await repository.upsertProduct(userId, { ...productInput, name: "Updated yoghurt" });
    const other = await repository.upsertProduct(otherUserId, productInput);

    expect(reused.id).toBe(created.id);
    expect(reused.name).toBe("Updated yoghurt");
    expect(other.id).not.toBe(created.id);
    expect(await repository.getProduct(otherUserId, created.id)).toBeUndefined();

    const search = await repository.searchProducts(userId, "updated", 1, 1);
    expect(search.items).toHaveLength(1);
    expect(search.items[0].barcode).toBe(productInput.barcode);
    expect((await repository.searchProducts(otherUserId, "", 1, 30)).items).toHaveLength(1);
  });

  it("records idempotently and returns entries only for the requested local day", async () => {
    const product = await repository.upsertProduct(userId, productInput);
    const input = {
      productId: product.id,
      mealType: "breakfast" as const,
      quantity: { unit: "g" as const, amount: 250 },
      occurredAt: new Date("2026-07-23T10:00:00.000Z"),
      timezone: "Europe/Prague",
      idempotencyKey: "chat-turn-1"
    };
    const first = await repository.recordFood(userId, input);
    const retry = await repository.recordFood(userId, input);

    expect(retry.id).toBe(first.id);
    expect(first.productSnapshot.nutrients.find((value) => value.key === "protein")?.value).toBe(22.5);
    expect(await repository.listFoodEntries(userId, "2026-07-23", "Europe/Prague")).toHaveLength(1);
    expect(await repository.listFoodEntries(otherUserId, "2026-07-23", "Europe/Prague")).toHaveLength(0);
  });

  it("creates a product and entry together, updates quantity and meal, aggregates, then deletes", async () => {
    const entry = await repository.recordFood(userId, {
      product: { ...productInput, barcode: "8591234567000", name: "Second product" },
      mealType: "snack",
      quantity: { unit: "g", amount: 100 },
      occurredAt: new Date("2026-07-24T10:00:00.000Z"),
      timezone: "UTC",
      idempotencyKey: "chat-turn-2"
    });
    const updated = await repository.updateFoodEntry(userId, entry.id, {
      mealType: "lunch",
      quantity: { unit: "g", amount: 50 }
    });
    expect(updated.mealType).toBe("lunch");
    expect(updated.productSnapshot.nutrients.find((value) => value.key === "energy_kcal")?.value).toBe(40);

    const entries = await repository.listFoodEntries(userId, "2026-07-24", "UTC");
    const aggregate = repository.aggregateNutrients(entries);
    expect(aggregate.find((value) => value.key === "salt")?.value).toBe(0.06);
    expect(aggregate.find((value) => value.key === "sodium")?.value).toBe(24);

    await repository.deleteFoodEntry(userId, entry.id);
    expect(await repository.getFoodEntry(userId, entry.id)).toBeUndefined();
  });

  it("rejects invalid product and quantity relationships", async () => {
    const product = await repository.upsertProduct(userId, productInput);
    await expect(repository.recordFood(userId, {
      productId: product.id,
      mealType: "dinner",
      quantity: { unit: "piece", amount: 1, size: "large" },
      occurredAt: new Date(),
      timezone: "UTC",
      idempotencyKey: "bad-piece"
    })).rejects.toThrow("unknown_piece_size");
    await expect(repository.recordFood(userId, {
      productId: product.id,
      mealType: "dinner",
      quantity: { unit: "ml", amount: 100 },
      occurredAt: new Date(),
      timezone: "UTC",
      idempotencyKey: "bad-unit"
    })).rejects.toThrow("incompatible_unit");
  });

  it("records an ad hoc entry without creating or touching a Product", async () => {
    const before = await repository.searchProducts(userId, "pancakes", 1, 30);
    const entry = await repository.recordAdHocFood(userId, {
      mealType: "breakfast",
      name: "3 pancakes, eyeballed",
      quantityLabel: "3 pancakes (~150 g, estimated)",
      nutrients: [{ key: "energy_kcal", label: "Energy", value: 300, unit: "kcal", provenance: "estimated" }],
      occurredAt: new Date("2026-07-25T08:00:00.000Z"),
      timezone: "UTC",
      idempotencyKey: "ad-hoc-1"
    });

    expect(entry.productId).toBeUndefined();
    expect(entry.quantity).toEqual({ unit: "as_consumed", label: "3 pancakes (~150 g, estimated)" });
    expect(entry.productSnapshot.nutrients[0].value).toBe(300);
    const after = await repository.searchProducts(userId, "pancakes", 1, 30);
    expect(after.items).toHaveLength(before.items.length);

    const retry = await repository.recordAdHocFood(userId, {
      mealType: "breakfast",
      name: "3 pancakes, eyeballed",
      quantityLabel: "3 pancakes (~150 g, estimated)",
      nutrients: [{ key: "energy_kcal", label: "Energy", value: 300, unit: "kcal", provenance: "estimated" }],
      occurredAt: new Date("2026-07-25T08:00:00.000Z"),
      timezone: "UTC",
      idempotencyKey: "ad-hoc-1"
    });
    expect(retry.id).toBe(entry.id);
  });

  it("edits an ad hoc entry's nutrients directly and rejects that override on a product-backed entry", async () => {
    const adHoc = await repository.recordAdHocFood(userId, {
      mealType: "snack",
      name: "Homemade soup",
      quantityLabel: "1 bowl",
      nutrients: [{ key: "energy_kcal", label: "Energy", value: 150, unit: "kcal", provenance: "estimated" }],
      occurredAt: new Date("2026-07-25T12:00:00.000Z"),
      timezone: "UTC",
      idempotencyKey: "ad-hoc-2"
    });
    const editedAdHoc = await repository.updateFoodEntry(userId, adHoc.id, {
      nutrients: [{ key: "energy_kcal", label: "Energy", value: 180, unit: "kcal", provenance: "estimated" }]
    });
    expect(editedAdHoc.productSnapshot.nutrients[0].value).toBe(180);

    const product = await repository.upsertProduct(userId, { ...productInput, barcode: "8591234567111", name: "Third product" });
    const productEntry = await repository.recordFood(userId, {
      productId: product.id,
      mealType: "snack",
      quantity: { unit: "g", amount: 100 },
      occurredAt: new Date("2026-07-25T13:00:00.000Z"),
      timezone: "UTC",
      idempotencyKey: "product-entry-1"
    });
    await expect(repository.updateFoodEntry(userId, productEntry.id, {
      nutrients: [{ key: "energy_kcal", label: "Energy", value: 999, unit: "kcal", provenance: "estimated" }]
    })).rejects.toThrow("cannot_override_nutrients_for_product_entry");
  });

  it("merges two entries into one ad hoc entry, sums nutrients, and deletes the originals", async () => {
    const product = await repository.upsertProduct(userId, { ...productInput, barcode: "8591234567222", name: "Coffee" });
    const first = await repository.recordFood(userId, {
      productId: product.id,
      mealType: "breakfast",
      quantity: { unit: "g", amount: 100 },
      occurredAt: new Date("2026-07-25T09:00:00.000Z"),
      timezone: "UTC",
      idempotencyKey: "merge-source-1"
    });
    const second = await repository.recordFood(userId, {
      productId: product.id,
      mealType: "breakfast",
      quantity: { unit: "g", amount: 100 },
      occurredAt: new Date("2026-07-25T09:30:00.000Z"),
      timezone: "UTC",
      idempotencyKey: "merge-source-2"
    });

    const merged = await repository.mergeFoodEntries(userId, {
      ids: [first.id, second.id],
      idempotencyKey: "merge-1"
    });

    expect(merged.productId).toBeUndefined();
    expect(merged.occurredAt).toEqual(first.occurredAt);
    expect(merged.productSnapshot.nutrients.find((value) => value.key === "energy_kcal")?.value).toBe(160);
    expect(await repository.getFoodEntry(userId, first.id)).toBeUndefined();
    expect(await repository.getFoodEntry(userId, second.id)).toBeUndefined();
    expect(await repository.getFoodEntry(userId, merged.id)).toBeDefined();

    await expect(repository.mergeFoodEntries(userId, { ids: [merged.id], idempotencyKey: "merge-2" }))
      .rejects.toThrow("merge_requires_at_least_two_entries");
    await expect(repository.mergeFoodEntries(userId, {
      ids: [merged.id, "00000000-0000-0000-0000-000000000000"],
      idempotencyKey: "merge-3"
    })).rejects.toThrow("entries_not_found");
  });

  it("auto-assigns servingSizes ids and keeps them stable across re-upserts", async () => {
    const created = await repository.upsertProduct(userId, {
      ...productInput,
      barcode: "8591234567333",
      name: "Banana",
      servingSizes: [{ label: "1 small banana", amount: 90, provenance: "estimated" }]
    });
    const assignedId = created.servingSizes[0].id;
    expect(assignedId).toBeTruthy();

    const resaved = await repository.upsertProduct(userId, {
      ...productInput,
      id: created.id,
      barcode: "8591234567333",
      name: "Banana",
      servingSizes: [{ label: "1 small banana", amount: 95, provenance: "estimated" }]
    });
    expect(resaved.servingSizes[0].id).toBe(assignedId);
    expect(resaved.servingSizes[0].amount).toBe(95);

    const entry = await repository.recordFood(userId, {
      productId: created.id,
      mealType: "snack",
      quantity: { unit: "serving", amount: 1, label: "irrelevant", servingSizeId: assignedId },
      occurredAt: new Date("2026-07-25T14:00:00.000Z"),
      timezone: "UTC",
      idempotencyKey: "serving-id-1"
    });
    expect(entry.productSnapshot.nutrients.find((value) => value.key === "energy_kcal")?.value).toBe(76);
  });
});
