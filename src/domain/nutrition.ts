import { z } from "zod";

export const nutrientProvenanceSchema = z.enum(["stated", "calculated", "estimated"]);
export const measurementUnitSchema = z.enum(["g", "ml"]);
export const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);
export const pieceSizeSchema = z.enum(["small", "regular", "medium", "large"]);

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
  servingSizes: z.array(servingSizeOptionSchema).default([])
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
});

export const productSchema = productInputSchema.safeExtend({
  id: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

export const foodQuantitySchema = z.discriminatedUnion("unit", [
  z.object({ unit: z.literal("g"), amount: z.number().positive() }),
  z.object({ unit: z.literal("ml"), amount: z.number().positive() }),
  z.object({ unit: z.literal("piece"), amount: z.number().positive(), size: pieceSizeSchema })
]);

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
  productId: z.string().uuid(),
  mealType: mealTypeSchema,
  quantity: foodQuantitySchema,
  productSnapshot: z.object({
    name: z.string(),
    brand: z.string().optional(),
    nutrients: z.array(nutrientSnapshotSchema)
  })
});

export type ProductInput = z.input<typeof productInputSchema>;
export type Product = z.infer<typeof productSchema>;
export type FoodQuantity = z.infer<typeof foodQuantitySchema>;
export type NutritionEntryPayload = z.infer<typeof nutritionEntryPayloadSchema>;

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
    if (!option) throw new Error("unknown_piece_size");
    return option.grams * quantity.amount;
  }
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
