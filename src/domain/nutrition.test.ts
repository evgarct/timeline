import { describe, expect, it } from "vitest";
import { productInputSchema, quantityInBaseUnit, snapshotNutrients } from "./nutrition";

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

  it("rejects an unknown serving size label", () => {
    expect(() => quantityInBaseUnit(product, { unit: "serving", amount: 1, label: "does not exist" }))
      .toThrow("unknown_serving_size");
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
});
