import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { database } from "@/db/client";
import { events, products } from "@/db/schema";
import {
  mealTypeSchema,
  normalizeProductText,
  nutritionEntryPayloadSchema,
  productInputSchema,
  productSchema,
  snapshotNutrients,
  type FoodQuantity,
  type NutrientSnapshot,
  type Product,
  type ProductInput
} from "@/domain/nutrition";
import { nutritionEntryEventSchema, type NutritionEntryEvent } from "@/domain/events";

const memoryProducts: Array<Product & { userId: string }> = [];
const memoryEntries: Array<NutritionEntryEvent & { userId: string; idempotencyKey?: string }> = [];
const useMemory = process.env.E2E_DEMO_MODE === "true" || !database;

function productFromRow(row: typeof products.$inferSelect): Product {
  return productSchema.parse({
    id: row.id,
    name: row.name,
    brand: row.brand ?? undefined,
    barcode: row.barcode ?? undefined,
    baseUnit: row.baseUnit,
    nutrientBases: row.nutrientBases,
    pieceSizes: row.pieceSizes,
    servingSizes: row.servingSizes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  });
}

export async function searchProducts(userId: string, query = "", page = 1, pageSize = 30) {
  const normalizedQuery = normalizeProductText(query);
  if (useMemory || !database) {
    const matches = memoryProducts.filter((product) => product.userId === userId && (
      !normalizedQuery
      || normalizeProductText(product.name).includes(normalizedQuery)
      || (product.brand && normalizeProductText(product.brand).includes(normalizedQuery))
      || product.barcode?.includes(query)
    ));
    const offset = (page - 1) * pageSize;
    return { items: matches.slice(offset, offset + pageSize), page, pageSize, hasMore: offset + pageSize < matches.length };
  }
  const offset = (page - 1) * pageSize;
  const condition = normalizedQuery
    ? and(
        eq(products.userId, userId),
        or(
          ilike(products.normalizedName, `%${normalizedQuery}%`),
          ilike(products.normalizedBrand, `%${normalizedQuery}%`),
          ilike(products.barcode, `%${query}%`)
        )
      )
    : eq(products.userId, userId);
  const rows = await database.select().from(products).where(condition).orderBy(desc(products.updatedAt)).limit(pageSize + 1).offset(offset);
  return {
    items: rows.slice(0, pageSize).map(productFromRow),
    page,
    pageSize,
    hasMore: rows.length > pageSize
  };
}

export async function recentProductsForMeal(
  userId: string,
  mealType: "breakfast" | "lunch" | "dinner" | "snack",
  page = 1,
  pageSize = 20
) {
  const history: NutritionEntryEvent[] = useMemory || !database
    ? memoryEntries.filter((entry) => entry.userId === userId)
    : (await database.select().from(events).where(and(
        eq(events.userId, userId),
        eq(events.type, "nutrition_entry")
      )).orderBy(desc(events.occurredAt))).map(entryFromRow);

  const seen = new Set<string>();
  const productIds: string[] = [];
  for (const entry of history) {
    if (entry.mealType !== mealType || !entry.productId || seen.has(entry.productId)) continue;
    seen.add(entry.productId);
    productIds.push(entry.productId);
  }

  const offset = (page - 1) * pageSize;
  const pageIds = productIds.slice(offset, offset + pageSize);
  const items = (await Promise.all(pageIds.map((id) => getProduct(userId, id))))
    .filter((product): product is Product => Boolean(product));
  return { items, page, pageSize, hasMore: offset + pageSize < productIds.length };
}

export async function getProduct(userId: string, id: string) {
  if (useMemory || !database) return memoryProducts.find((product) => product.userId === userId && product.id === id);
  const [row] = await database.select().from(products).where(and(eq(products.userId, userId), eq(products.id, id))).limit(1);
  return row ? productFromRow(row) : undefined;
}

export async function upsertProduct(userId: string, rawInput: ProductInput) {
  const input = productInputSchema.parse(rawInput);
  const normalizedName = normalizeProductText(input.name);
  const normalizedBrand = input.brand ? normalizeProductText(input.brand) : undefined;
  const now = new Date();

  let existing: Product | undefined;
  if (input.id) existing = await getProduct(userId, input.id);
  if (!existing && input.barcode) {
    const result = await searchProducts(userId, input.barcode, 1, 10);
    existing = result.items.find((product) => product.barcode === input.barcode);
  }
  if (!existing && !input.barcode) {
    const result = await searchProducts(userId, input.name, 1, 20);
    const exact = result.items.filter((product) => (
      normalizeProductText(product.name) === normalizedName
      && normalizeProductText(product.brand ?? "") === normalizeProductText(input.brand ?? "")
    ));
    if (exact.length > 1) throw new Error("ambiguous_product");
    existing = exact[0];
  }

  const servingSizes = input.servingSizes.map((serving) => ({
    ...serving,
    id: serving.id
      ?? existing?.servingSizes.find((existingServing) => existingServing.label === serving.label)?.id
      ?? randomUUID()
  }));
  const product = productSchema.parse({
    ...input,
    servingSizes,
    id: existing?.id ?? randomUUID(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  });
  if (useMemory || !database) {
    const index = memoryProducts.findIndex((item) => item.userId === userId && item.id === product.id);
    const stored = { ...product, userId };
    if (index >= 0) memoryProducts[index] = stored;
    else memoryProducts.unshift(stored);
    return product;
  }
  const values = {
    id: product.id,
    userId,
    name: product.name,
    normalizedName,
    brand: product.brand,
    normalizedBrand,
    barcode: product.barcode,
    baseUnit: product.baseUnit,
    nutrientBases: product.nutrientBases,
    pieceSizes: product.pieceSizes,
    servingSizes: product.servingSizes,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
  await database.insert(products).values(values).onConflictDoUpdate({
    target: products.id,
    set: {
      name: values.name,
      normalizedName: values.normalizedName,
      brand: values.brand,
      normalizedBrand: values.normalizedBrand,
      barcode: values.barcode,
      baseUnit: values.baseUnit,
      nutrientBases: values.nutrientBases,
      pieceSizes: values.pieceSizes,
      servingSizes: values.servingSizes,
      updatedAt: values.updatedAt
    }
  });
  return product;
}

export interface RecordFoodInput {
  productId?: string;
  product?: ProductInput;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  quantity: FoodQuantity;
  occurredAt: Date;
  timezone: string;
  note?: string;
  idempotencyKey: string;
}

export async function recordFood(userId: string, rawInput: RecordFoodInput) {
  const mealType = mealTypeSchema.parse(rawInput.mealType);
  if (!rawInput.idempotencyKey.trim()) throw new Error("idempotency_key_required");
  const existing = await findEntryByIdempotencyKey(userId, rawInput.idempotencyKey);
  if (existing) return existing;
  const product = rawInput.product
    ? await upsertProduct(userId, rawInput.product)
    : rawInput.productId ? await getProduct(userId, rawInput.productId) : undefined;
  if (!product) throw new Error("product_not_found");
  const payload = nutritionEntryPayloadSchema.parse({
    productId: product.id,
    mealType,
    quantity: rawInput.quantity,
    productSnapshot: {
      name: product.name,
      brand: product.brand,
      nutrients: snapshotNutrients(product, rawInput.quantity)
    }
  });
  const entry = nutritionEntryEventSchema.parse({
    id: randomUUID(),
    type: "nutrition_entry",
    occurredAt: rawInput.occurredAt,
    timezone: rawInput.timezone,
    note: rawInput.note,
    ...payload
  });
  return insertNutritionEntry(userId, entry, rawInput.idempotencyKey);
}

export interface RecordAdHocFoodInput {
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  brand?: string;
  quantityLabel: string;
  nutrients: NutrientSnapshot[];
  occurredAt: Date;
  timezone: string;
  note?: string;
  idempotencyKey: string;
}

export async function recordAdHocFood(userId: string, rawInput: RecordAdHocFoodInput) {
  const mealType = mealTypeSchema.parse(rawInput.mealType);
  if (!rawInput.idempotencyKey.trim()) throw new Error("idempotency_key_required");
  const existing = await findEntryByIdempotencyKey(userId, rawInput.idempotencyKey);
  if (existing) return existing;
  const payload = nutritionEntryPayloadSchema.parse({
    mealType,
    quantity: { unit: "as_consumed", label: rawInput.quantityLabel },
    productSnapshot: {
      name: rawInput.name,
      brand: rawInput.brand,
      nutrients: rawInput.nutrients
    }
  });
  const entry = nutritionEntryEventSchema.parse({
    id: randomUUID(),
    type: "nutrition_entry",
    occurredAt: rawInput.occurredAt,
    timezone: rawInput.timezone,
    note: rawInput.note,
    ...payload
  });
  return insertNutritionEntry(userId, entry, rawInput.idempotencyKey);
}

async function insertNutritionEntry(userId: string, entry: NutritionEntryEvent, idempotencyKey: string) {
  if (useMemory || !database) {
    memoryEntries.unshift({ ...entry, userId, idempotencyKey });
    return entry;
  }
  const { id, type, occurredAt, timezone, note, ...storedPayload } = entry;
  await database.insert(events).values({
    id, userId, type, occurredAt, timezone, note, payload: storedPayload,
    idempotencyKey
  });
  return entry;
}

async function findEntryByIdempotencyKey(userId: string, key: string) {
  if (useMemory || !database) {
    return memoryEntries.find((entry) => entry.userId === userId && entry.idempotencyKey === key);
  }
  const [row] = await database.select().from(events).where(and(
    eq(events.userId, userId),
    eq(events.idempotencyKey, key)
  )).limit(1);
  return row ? entryFromRow(row) : undefined;
}

function entryFromRow(row: typeof events.$inferSelect): NutritionEntryEvent {
  return nutritionEntryEventSchema.parse({
    id: row.id,
    type: row.type,
    occurredAt: row.occurredAt,
    timezone: row.timezone,
    note: row.note ?? undefined,
    ...(row.payload as object)
  });
}

function dateKey(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(date);
}

export async function listFoodEntries(userId: string, date: string, timezone: string) {
  const all: NutritionEntryEvent[] = useMemory || !database
    ? memoryEntries.filter((entry) => entry.userId === userId)
    : (await database.select().from(events).where(and(
        eq(events.userId, userId),
        eq(events.type, "nutrition_entry")
      )).orderBy(desc(events.occurredAt))).map(entryFromRow);
  return all.filter((entry) => dateKey(entry.occurredAt, timezone) === date);
}

export async function getFoodEntry(userId: string, id: string) {
  if (useMemory || !database) return memoryEntries.find((entry) => entry.userId === userId && entry.id === id);
  const [row] = await database.select().from(events).where(and(
    eq(events.userId, userId), eq(events.id, id), eq(events.type, "nutrition_entry")
  )).limit(1);
  return row ? entryFromRow(row) : undefined;
}

export interface UpdateFoodEntryChanges {
  mealType?: RecordFoodInput["mealType"];
  quantity?: FoodQuantity;
  occurredAt?: Date;
  timezone?: string;
  note?: string;
  nutrients?: NutrientSnapshot[];
  name?: string;
  brand?: string;
}

export async function updateFoodEntry(userId: string, id: string, changes: UpdateFoodEntryChanges) {
  const current = await getFoodEntry(userId, id);
  if (!current) throw new Error("entry_not_found");

  const overridesDerivedFields = changes.nutrients !== undefined || changes.name !== undefined || changes.brand !== undefined;
  let productSnapshot = current.productSnapshot;
  const quantity = changes.quantity ?? current.quantity;

  if (current.productId) {
    if (overridesDerivedFields) throw new Error("cannot_override_nutrients_for_product_entry");
    const product = await getProduct(userId, current.productId);
    if (!product) throw new Error("product_not_found");
    productSnapshot = {
      name: current.productSnapshot.name,
      brand: current.productSnapshot.brand,
      nutrients: snapshotNutrients(product, quantity)
    };
  } else {
    if (changes.quantity && changes.quantity.unit !== "as_consumed") {
      throw new Error("invalid_quantity_for_ad_hoc_entry");
    }
    productSnapshot = {
      name: changes.name ?? current.productSnapshot.name,
      brand: changes.brand ?? current.productSnapshot.brand,
      nutrients: changes.nutrients ?? current.productSnapshot.nutrients
    };
  }

  const payload = nutritionEntryPayloadSchema.parse({
    productId: current.productId,
    mealType: changes.mealType ?? current.mealType,
    quantity,
    productSnapshot
  });
  const updated = nutritionEntryEventSchema.parse({
    ...current,
    occurredAt: changes.occurredAt ?? current.occurredAt,
    timezone: changes.timezone ?? current.timezone,
    note: changes.note ?? current.note,
    ...payload
  });
  if (useMemory || !database) {
    const index = memoryEntries.findIndex((entry) => entry.userId === userId && entry.id === id);
    if (index >= 0) memoryEntries[index] = { ...memoryEntries[index], ...updated };
    return updated;
  }
  const { occurredAt, timezone, note, productId, mealType, quantity: storedQuantity, productSnapshot: storedSnapshot } = updated;
  await database.update(events).set({
    occurredAt, timezone, note,
    payload: { productId, mealType, quantity: storedQuantity, productSnapshot: storedSnapshot },
    updatedAt: new Date()
  }).where(and(eq(events.userId, userId), eq(events.id, id), eq(events.type, "nutrition_entry")));
  return updated;
}

export async function deleteFoodEntry(userId: string, id: string) {
  if (useMemory || !database) {
    const index = memoryEntries.findIndex((entry) => entry.userId === userId && entry.id === id);
    if (index >= 0) memoryEntries.splice(index, 1);
    return;
  }
  await database.delete(events).where(and(
    eq(events.userId, userId), eq(events.id, id), eq(events.type, "nutrition_entry")
  ));
}

export interface MergeFoodEntriesInput {
  ids: string[];
  mealType?: RecordFoodInput["mealType"];
  occurredAt?: Date;
  timezone?: string;
  note?: string;
  name?: string;
  idempotencyKey: string;
}

export async function mergeFoodEntries(userId: string, rawInput: MergeFoodEntriesInput) {
  if (rawInput.ids.length < 2) throw new Error("merge_requires_at_least_two_entries");
  if (!rawInput.idempotencyKey.trim()) throw new Error("idempotency_key_required");
  const existing = await findEntryByIdempotencyKey(userId, rawInput.idempotencyKey);
  if (existing) return existing;

  const fetched = await Promise.all(rawInput.ids.map((id) => getFoodEntry(userId, id)));
  const missing = rawInput.ids.filter((_, index) => !fetched[index]);
  if (missing.length) throw new Error(`entries_not_found:${missing.join(",")}`);
  const found = fetched as NutritionEntryEvent[];

  const nutrients = aggregateNutrients(found);
  const distinctNames = [...new Set(found.map((entry) => entry.productSnapshot.name))];
  const name = rawInput.name ?? distinctNames.join(" + ");
  const mealType = mealTypeSchema.parse(rawInput.mealType ?? found[0].mealType);
  const occurredAt = rawInput.occurredAt ?? found.reduce(
    (earliest, entry) => (entry.occurredAt < earliest ? entry.occurredAt : earliest),
    found[0].occurredAt
  );
  const timezone = rawInput.timezone ?? found[0].timezone;
  const label = `Merged ${found.length} entries: ${distinctNames.join(", ")}`;

  const payload = nutritionEntryPayloadSchema.parse({
    mealType,
    quantity: { unit: "as_consumed", label },
    productSnapshot: { name, nutrients }
  });
  const merged = nutritionEntryEventSchema.parse({
    id: randomUUID(),
    type: "nutrition_entry",
    occurredAt,
    timezone,
    note: rawInput.note,
    ...payload
  });

  if (useMemory || !database) {
    for (const id of rawInput.ids) {
      const index = memoryEntries.findIndex((entry) => entry.userId === userId && entry.id === id);
      if (index >= 0) memoryEntries.splice(index, 1);
    }
    memoryEntries.unshift({ ...merged, userId, idempotencyKey: rawInput.idempotencyKey });
    return merged;
  }

  const { id, type, occurredAt: mergedOccurredAt, timezone: mergedTimezone, note, ...storedPayload } = merged;
  await database.batch([
    database.delete(events).where(and(
      eq(events.userId, userId), inArray(events.id, rawInput.ids), eq(events.type, "nutrition_entry")
    )),
    database.insert(events).values({
      id, userId, type, occurredAt: mergedOccurredAt, timezone: mergedTimezone, note,
      payload: storedPayload, idempotencyKey: rawInput.idempotencyKey
    })
  ]);
  return merged;
}

export function aggregateNutrients(entries: Awaited<ReturnType<typeof listFoodEntries>>) {
  const values = new Map<string, { key?: string; label: string; unit: string; value: number; provenance: string }>();
  for (const entry of entries) {
    for (const nutrient of entry.productSnapshot.nutrients) {
      if (nutrient.value === undefined) continue;
      const identity = `${nutrient.key ?? nutrient.label.toLocaleLowerCase()}::${nutrient.unit}`;
      const current = values.get(identity);
      values.set(identity, {
        key: nutrient.key,
        label: nutrient.label,
        unit: nutrient.unit,
        value: (current?.value ?? 0) + nutrient.value,
        provenance: current?.provenance === "estimated" || nutrient.provenance === "estimated"
          ? "estimated"
          : current?.provenance === "calculated" || nutrient.provenance === "calculated"
            ? "calculated"
            : "stated"
      });
    }
  }
  return [...values.values()];
}
