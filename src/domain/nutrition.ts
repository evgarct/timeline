import { z } from "zod";

export const nutrientProvenanceSchema = z.enum(["stated", "calculated", "estimated"]);
export const measurementUnitSchema = z.enum(["g", "ml"]);
export const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);
export const pieceSizeSchema = z.enum(["small", "regular", "medium", "large"]);

// Free multilingual text — not a fixed enum. The assistant fills this in per-product/entry, the same
// way it already fills searchAliases in other languages.
export const localizedTextSchema = z.object({
  en: z.string().trim().min(1).max(200).optional(),
  ru: z.string().trim().min(1).max(200).optional(),
  cs: z.string().trim().min(1).max(200).optional()
}).optional();

export const nutrientValueSchema = z.object({
  key: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1),
  value: z.number().finite().nonnegative().optional(),
  unit: z.string().trim().min(1),
  qualifier: z.enum(["less_than", "trace", "approximately"]).optional(),
  originalText: z.string().trim().min(1).optional(),
  dailyValuePercent: z.number().finite().nonnegative().optional(),
  provenance: nutrientProvenanceSchema
}).refine((value) => value.value !== undefined || value.qualifier !== undefined, {
  message: "A nutrient requires a numeric value or qualifier"
});

export const nutrientBaseSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  amount: z.number().positive(),
  unit: measurementUnitSchema,
  nutrients: z.array(nutrientValueSchema).min(1)
});

export const pieceSizeOptionSchema = z.object({
  size: pieceSizeSchema,
  grams: z.number().positive(),
  provenance: nutrientProvenanceSchema
});

export const servingSizeOptionSchema = z.object({
  id: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1).max(60),
  amount: z.number().positive(),
  provenance: nutrientProvenanceSchema
});

export const productInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(300),
  brand: z.string().trim().min(1).max(200).optional(),
  barcode: z.string().trim().min(4).max(64).optional(),
  baseUnit: measurementUnitSchema,
  nutrientBases: z.array(nutrientBaseSchema).min(1),
  pieceSizes: z.array(pieceSizeOptionSchema).default([]),
  servingSizes: z.array(servingSizeOptionSchema).default([]),
  // Extra search terms in other languages/spellings, e.g. ["кофе", "coffee", "káva"] on "Café au Lait".
  searchAliases: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  // Category (e.g. coffee, protein drink, protein powder) in en/ru/cs — free text, not an enum.
  type: localizedTextSchema,
  // Product name with the brand stripped, in en/ru/cs.
  genericName: localizedTextSchema
}).superRefine((product, context) => {
  if (product.pieceSizes.length && product.baseUnit !== "g") {
    context.addIssue({ code: "custom", message: "Piece sizes require a gram-based product" });
  }
  const sizeNames = product.pieceSizes.map((size) => size.size);
  if (new Set(sizeNames).size !== sizeNames.length) {
    context.addIssue({ code: "custom", message: "Piece sizes must be unique" });
  }
  const servingLabels = product.servingSizes.map((serving) => serving.label);
  if (new Set(servingLabels).size !== servingLabels.length) {
    context.addIssue({ code: "custom", message: "Serving sizes must be unique" });
  }
  const servingIds = product.servingSizes.map((serving) => serving.id).filter((id): id is string => id !== undefined);
  if (new Set(servingIds).size !== servingIds.length) {
    context.addIssue({ code: "custom", message: "Serving size ids must be unique" });
  }
});

export const productSchema = productInputSchema.safeExtend({
  id: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

export const foodQuantitySchema = z.discriminatedUnion("unit", [
  z.object({ unit: z.literal("g"), amount: z.number().positive() }),
  z.object({ unit: z.literal("ml"), amount: z.number().positive() }),
  z.object({ unit: z.literal("piece"), amount: z.number().positive(), size: pieceSizeSchema }),
  z.object({
    unit: z.literal("serving"),
    amount: z.number().positive(),
    label: z.string().trim().min(1).max(60).optional(),
    servingSizeId: z.string().trim().min(1).optional()
  }),
  z.object({ unit: z.literal("as_consumed"), label: z.string().trim().min(1).max(120) })
]).superRefine((quantity, context) => {
  if (quantity.unit === "serving" && !quantity.label && !quantity.servingSizeId) {
    context.addIssue({ code: "custom", message: "Provide either label or servingSizeId for a serving quantity" });
  }
});

export const nutrientSnapshotSchema = z.object({
  key: z.string().optional(),
  label: z.string(),
  value: z.number().nonnegative().optional(),
  unit: z.string(),
  qualifier: nutrientValueSchema.shape.qualifier,
  originalText: z.string().optional(),
  provenance: nutrientProvenanceSchema
});

export const nutritionEntryPayloadSchema = z.object({
  productId: z.string().uuid().optional(),
  mealType: mealTypeSchema,
  quantity: foodQuantitySchema,
  productSnapshot: z.object({
    name: z.string(),
    brand: z.string().optional(),
    nutrients: z.array(nutrientSnapshotSchema),
    type: localizedTextSchema,
    genericName: localizedTextSchema,
    // The quantity actually consumed, converted to the product's own base unit (g/ml) — computed once
    // at log time so the report can always show a real weight/volume instead of e.g. "2 capsules".
    // Undefined for ad-hoc entries, which have no product/conversion to derive this from.
    baseAmount: z.object({
      amount: z.number().positive(),
      unit: measurementUnitSchema
    }).optional()
  })
}).superRefine((value, context) => {
  const isAdHoc = value.quantity.unit === "as_consumed";
  if (value.productId && isAdHoc) {
    context.addIssue({ code: "custom", message: "productId requires a scaled quantity, not as_consumed" });
  }
  if (!value.productId && !isAdHoc) {
    context.addIssue({ code: "custom", message: "Ad-hoc entries (no productId) require quantity.unit \"as_consumed\"" });
  }
});

export type ProductInput = z.input<typeof productInputSchema>;
export type Product = z.infer<typeof productSchema>;
export type FoodQuantity = z.infer<typeof foodQuantitySchema>;
export type NutritionEntryPayload = z.infer<typeof nutritionEntryPayloadSchema>;
export type NutrientSnapshot = z.infer<typeof nutrientSnapshotSchema>;

export function normalizeProductText(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export function selectCalculationBase(product: Product | z.output<typeof productInputSchema>) {
  return product.nutrientBases.find((base) => base.unit === product.baseUnit)
    ?? product.nutrientBases[0];
}

export function quantityInBaseUnit(
  product: Product | z.output<typeof productInputSchema>,
  quantity: FoodQuantity
) {
  if (quantity.unit === "piece") {
    const option = product.pieceSizes.find((size) => size.size === quantity.size);
    if (!option) {
      const available = product.pieceSizes.map((size) => size.size);
      const hint = available.length
        ? `this product's registered pieceSizes are: ${available.join(", ")}`
        : product.servingSizes.length
          ? `this product has no pieceSizes; it has servingSizes instead — use unit: "serving" with one of: ${product.servingSizes.map((serving) => JSON.stringify(serving.label)).join(", ")}`
          : "this product has no pieceSizes or servingSizes registered — add one via upsert_product first (pieceSizes and servingSizes are per-product, there is no shared/built-in catalog)";
      throw new Error(`unknown_piece_size: requested "${quantity.size}", but ${hint}`);
    }
    return option.grams * quantity.amount;
  }
  if (quantity.unit === "serving") {
    const option = quantity.servingSizeId
      ? product.servingSizes.find((serving) => serving.id === quantity.servingSizeId)
      : product.servingSizes.find((serving) => serving.label === quantity.label);
    if (!option) {
      const available = product.servingSizes.map((serving) => (
        serving.id ? `${JSON.stringify(serving.label)} (id: ${serving.id})` : JSON.stringify(serving.label)
      ));
      const requested = quantity.servingSizeId ? `servingSizeId ${JSON.stringify(quantity.servingSizeId)}` : `label ${JSON.stringify(quantity.label)}`;
      const hint = available.length
        ? `this product's registered servingSizes are: ${available.join(", ")}`
        : "this product has no servingSizes registered — add one via upsert_product first (servingSizes are per-product, there is no shared/built-in catalog)";
      throw new Error(`unknown_serving_size: requested ${requested}, but ${hint}`);
    }
    return option.amount * quantity.amount;
  }
  if (quantity.unit === "as_consumed") throw new Error("incompatible_unit");
  if (quantity.unit !== product.baseUnit) throw new Error("incompatible_unit");
  return quantity.amount;
}

export function snapshotNutrients(
  product: Product | z.output<typeof productInputSchema>,
  quantity: FoodQuantity
) {
  const base = selectCalculationBase(product);
  const multiplier = quantityInBaseUnit(product, quantity) / base.amount;
  return base.nutrients.map((nutrient) => ({
    key: nutrient.key,
    label: nutrient.label,
    value: nutrient.value === undefined ? undefined : nutrient.value * multiplier,
    unit: nutrient.unit,
    qualifier: nutrient.qualifier,
    originalText: nutrient.originalText,
    provenance: nutrient.provenance
  }));
}

export const canonicalMacroKeys = {
  energy: "energy_kcal",
  protein: "protein",
  fat: "fat",
  carbohydrates: "carbohydrates"
} as const;

export function describeQuantity(quantity: FoodQuantity): string {
  switch (quantity.unit) {
    case "g": return `${quantity.amount} g`;
    case "ml": return `${quantity.amount} ml`;
    case "piece": return `${quantity.amount}x ${quantity.size} piece`;
    case "serving": return quantity.label
      ? `${quantity.amount}x "${quantity.label}"`
      : `${quantity.amount}x (serving id: ${quantity.servingSizeId})`;
    case "as_consumed": return quantity.label;
  }
}

export function summarizeMacros(
  nutrients: ReadonlyArray<{ key?: string; value?: number } & Record<string, unknown>>
): string {
  const find = (key: string) => nutrients.find((nutrient) => nutrient.key === key)?.value;
  const kcal = find(canonicalMacroKeys.energy);
  const protein = find(canonicalMacroKeys.protein);
  const fat = find(canonicalMacroKeys.fat);
  const carbs = find(canonicalMacroKeys.carbohydrates);
  const parts = [
    kcal !== undefined ? `${Math.round(kcal)} kcal` : undefined,
    protein !== undefined ? `${protein.toFixed(1)}g protein` : undefined,
    fat !== undefined ? `${fat.toFixed(1)}g fat` : undefined,
    carbs !== undefined ? `${carbs.toFixed(1)}g carbs` : undefined
  ].filter((part): part is string => part !== undefined);
  return parts.length ? parts.join(", ") : "no macro data";
}
