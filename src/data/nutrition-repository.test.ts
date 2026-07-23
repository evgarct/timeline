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
});
