import { describe, expect, it } from "vitest";
import {
  describeQuantity,
  nutritionEntryPayloadSchema,
  productInputSchema,
  quantityInBaseUnit,
  snapshotNutrients,
  summarizeMacros
} from "./nutrition";

const product = productInputSchema.parse({
  name: "Complete label",
  brand: "Form",
  barcode: "859000000001",
  baseUnit: "g",
  nutrientBases: [
    {
      id: "per-100-g",
      label: "Per 100 g",
      amount: 100,
      unit: "g",
      nutrients: [
        { key: "energy_kcal", label: "Energy", value: 200, unit: "kcal", provenance: "stated" },
        { key: "fat", label: "Fat", value: 10, unit: "g", provenance: "stated" },
        { key: "saturated_fat", label: "of which saturates", value: 4, unit: "g", provenance: "stated" },
        { key: "salt", label: "Salt", value: 1.2, unit: "g", provenance: "stated" },
        { key: "sodium", label: "Sodium", value: 480, unit: "mg", provenance: "stated" },
        { label: "Manufacturer complex X", qualifier: "less_than", value: 0.1, unit: "mg", originalText: "< 0.1 mg", provenance: "stated" },
        { key: "vitamin_c", label: "Vitamin C", value: 20, unit: "mg", dailyValuePercent: 25, provenance: "stated" }
      ]
    },
    {
      id: "per-pack",
      label: "Per pack",
      amount: 250,
      unit: "g",
      nutrients: [
        { key: "energy_kcal", label: "Energy", value: 500, unit: "kcal", provenance: "stated" }
      ]
    }
  ],
  pieceSizes: [{ size: "regular", grams: 50, provenance: "estimated" }],
  servingSizes: [{ label: "1 bar (40 g)", amount: 40, provenance: "stated" }]
});

describe("nutrition domain", () => {
  it("preserves arbitrary nutrients, qualifiers, provenance, and multiple bases", () => {
    expect(product.nutrientBases).toHaveLength(2);
    expect(product.nutrientBases[0].nutrients).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "salt", value: 1.2 }),
      expect.objectContaining({ key: "sodium", value: 480 }),
      expect.objectContaining({ label: "Manufacturer complex X", qualifier: "less_than", originalText: "< 0.1 mg" }),
      expect.objectContaining({ key: "vitamin_c", dailyValuePercent: 25 })
    ]));
  });

  it("keeps salt, sodium, and fat types separate when scaling grams", () => {
    const snapshot = snapshotNutrients(product, { unit: "g", amount: 25 });
    expect(snapshot.find((value) => value.key === "salt")?.value).toBe(0.3);
    expect(snapshot.find((value) => value.key === "sodium")?.value).toBe(120);
    expect(snapshot.find((value) => value.key === "saturated_fat")?.value).toBe(1);
  });

  it("uses product-specific piece weights", () => {
    const snapshot = snapshotNutrients(product, { unit: "piece", amount: 2, size: "regular" });
    expect(snapshot.find((value) => value.key === "energy_kcal")?.value).toBe(200);
  });

  it("resolves quantities expressed as a named serving size", () => {
    const snapshot = snapshotNutrients(product, { unit: "serving", amount: 1, label: "1 bar (40 g)" });
    expect(snapshot.find((value) => value.key === "energy_kcal")?.value).toBe(80);
  });

  it("scales a serving size by a fractional multiplier", () => {
    expect(quantityInBaseUnit(product, { unit: "serving", amount: 2.5, label: "1 bar (40 g)" })).toBe(100);
  });

  it("rejects an unknown serving size label and lists what is registered", () => {
    expect(() => quantityInBaseUnit(product, { unit: "serving", amount: 1, label: "does not exist" }))
      .toThrow('unknown_serving_size: requested "does not exist", but this product\'s registered servingSizes are: "1 bar (40 g)"');
  });

  it("rejects an unknown piece size and points to servingSizes when pieceSizes is empty", () => {
    const productWithoutPieceSizes = productInputSchema.parse({ ...product, pieceSizes: [] });
    expect(() => quantityInBaseUnit(productWithoutPieceSizes, { unit: "piece", amount: 1, size: "large" }))
      .toThrow('this product has no pieceSizes; it has servingSizes instead — use unit: "serving" with one of: "1 bar (40 g)"');
  });

  it("rejects an unknown piece size and lists what is registered when pieceSizes is non-empty", () => {
    expect(() => quantityInBaseUnit(product, { unit: "piece", amount: 1, size: "large" }))
      .toThrow("this product's registered pieceSizes are: regular");
  });

  it("rejects unmarked inferred values", () => {
    expect(() => productInputSchema.parse({
      ...product,
      nutrientBases: [{
        id: "bad", label: "Bad", amount: 100, unit: "g",
        nutrients: [{ key: "fiber", label: "Fiber", value: 2, unit: "g" }]
      }]
    })).toThrow();
  });

  it("rejects an as_consumed quantity when computing a product's base amount", () => {
    expect(() => quantityInBaseUnit(product, { unit: "as_consumed", label: "3 pancakes" }))
      .toThrow("incompatible_unit");
  });

  describe("nutritionEntryPayloadSchema ad-hoc invariant", () => {
    const nutrients = [{ key: "energy_kcal", label: "Energy", value: 100, unit: "kcal", provenance: "estimated" as const }];

    it("accepts a productId paired with a scaled quantity", () => {
      expect(() => nutritionEntryPayloadSchema.parse({
        productId: "00000000-0000-0000-0000-000000000000",
        mealType: "snack",
        quantity: { unit: "g", amount: 100 },
        productSnapshot: { name: "Product", nutrients }
      })).not.toThrow();
    });

    it("accepts an ad-hoc entry (no productId) with an as_consumed quantity", () => {
      expect(() => nutritionEntryPayloadSchema.parse({
        mealType: "snack",
        quantity: { unit: "as_consumed", label: "3 pancakes" },
        productSnapshot: { name: "Pancakes", nutrients }
      })).not.toThrow();
    });

    it("rejects a productId paired with an as_consumed quantity", () => {
      expect(() => nutritionEntryPayloadSchema.parse({
        productId: "00000000-0000-0000-0000-000000000000",
        mealType: "snack",
        quantity: { unit: "as_consumed", label: "3 pancakes" },
        productSnapshot: { name: "Product", nutrients }
      })).toThrow();
    });

    it("rejects an ad-hoc entry (no productId) with a scaled quantity", () => {
      expect(() => nutritionEntryPayloadSchema.parse({
        mealType: "snack",
        quantity: { unit: "g", amount: 100 },
        productSnapshot: { name: "Pancakes", nutrients }
      })).toThrow();
    });
  });

  describe("describeQuantity", () => {
    it("formats every quantity variant", () => {
      expect(describeQuantity({ unit: "g", amount: 100 })).toBe("100 g");
      expect(describeQuantity({ unit: "ml", amount: 250 })).toBe("250 ml");
      expect(describeQuantity({ unit: "piece", amount: 2, size: "regular" })).toBe("2x regular piece");
      expect(describeQuantity({ unit: "serving", amount: 1, label: "1 bar (40 g)" })).toBe("1x \"1 bar (40 g)\"");
      expect(describeQuantity({ unit: "as_consumed", label: "3 pancakes" })).toBe("3 pancakes");
    });
  });

  describe("summarizeMacros", () => {
    it("formats the canonical macros when present", () => {
      const summary = summarizeMacros([
        { key: "energy_kcal", label: "Energy", value: 210.4, unit: "kcal", provenance: "stated" },
        { key: "protein", label: "Protein", value: 9, unit: "g", provenance: "stated" },
        { key: "fat", label: "Fat", value: 8.2, unit: "g", provenance: "stated" },
        { key: "carbohydrates", label: "Carbs", value: 22, unit: "g", provenance: "stated" }
      ]);
      expect(summary).toBe("210 kcal, 9.0g protein, 8.2g fat, 22.0g carbs");
    });

    it("falls back when no canonical macros are present", () => {
      expect(summarizeMacros([{ key: "vitamin_c", label: "Vitamin C", value: 20, unit: "mg", provenance: "stated" }]))
        .toBe("no macro data");
    });
  });
});
