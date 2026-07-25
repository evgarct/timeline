import "server-only";
import { and, eq, inArray, lt } from "drizzle-orm";
import { database } from "@/db/client";
import { nutritionReports } from "@/db/schema";

export type NutritionReport = typeof nutritionReports.$inferSelect;

const useMemory = process.env.E2E_DEMO_MODE === "true";
const memoryReports: NutritionReport[] = [];

function requireDatabase() {
  if (!database) throw new Error("Database is not configured");
  return database;
}

export async function createNutritionReport(input: {
  id: string;
  userId: string;
  reportDate: string;
  timezone: string;
  pdfObjectKey: string;
  ogImageObjectKey: string;
  pdfSizeBytes: number;
  ogImageSizeBytes: number;
  expiresAt: Date;
}) {
  if (useMemory) {
    const report = { ...input, createdAt: new Date() } satisfies NutritionReport;
    memoryReports.push(report);
    return report;
  }
  const [report] = await requireDatabase().insert(nutritionReports).values(input).returning();
  return report;
}

// The id is the capability — no userId gate, since public serving routes are unauthenticated.
export async function getNutritionReport(id: string) {
  if (useMemory) return memoryReports.find((report) => report.id === id) ?? null;
  if (!database) return null;
  const [report] = await database.select().from(nutritionReports)
    .where(eq(nutritionReports.id, id))
    .limit(1);
  return report ?? null;
}

export async function getNutritionReportForUser(userId: string, id: string) {
  if (useMemory) return memoryReports.find((report) => report.userId === userId && report.id === id) ?? null;
  if (!database) return null;
  const [report] = await database.select().from(nutritionReports)
    .where(and(eq(nutritionReports.userId, userId), eq(nutritionReports.id, id)))
    .limit(1);
  return report ?? null;
}

export async function listExpiredNutritionReports(cutoff: Date) {
  if (useMemory) return memoryReports.filter((report) => report.expiresAt < cutoff);
  if (!database) return [];
  return database.select().from(nutritionReports).where(lt(nutritionReports.expiresAt, cutoff));
}

export async function deleteNutritionReportRows(ids: string[]) {
  if (useMemory) {
    for (let index = memoryReports.length - 1; index >= 0; index -= 1) {
      const report = memoryReports[index];
      if (report && ids.includes(report.id)) memoryReports.splice(index, 1);
    }
    return;
  }
  if (!database || !ids.length) return;
  await database.delete(nutritionReports).where(inArray(nutritionReports.id, ids));
}
