import "server-only";
import { and, eq, gte, lte } from "drizzle-orm";
import { database } from "@/db/client";
import { dailyActivity } from "@/db/schema";

export type DailyActivity = typeof dailyActivity.$inferSelect;

const useMemory = process.env.E2E_DEMO_MODE === "true";
const memoryActivity: DailyActivity[] = [];

export type UpsertDailyActivityInput = {
  userId: string;
  activityDate: string;
  timezone: string;
  steps: number;
  goalSteps: number;
  distanceMeters?: number | null;
  weeklyAverage?: number | null;
  workoutCount?: number;
  workoutSummary?: unknown;
};

export async function upsertDailyActivity(input: UpsertDailyActivityInput) {
  const workoutCount = input.workoutCount ?? 0;

  if (useMemory || !database) {
    const index = memoryActivity.findIndex(
      (row) => row.userId === input.userId && row.activityDate === input.activityDate
    );
    const now = new Date();
    const row: DailyActivity = {
      id: index >= 0 ? memoryActivity[index]!.id : crypto.randomUUID(),
      userId: input.userId,
      activityDate: input.activityDate,
      timezone: input.timezone,
      steps: input.steps,
      goalSteps: input.goalSteps,
      distanceMeters: input.distanceMeters ?? null,
      weeklyAverage: input.weeklyAverage ?? null,
      workoutCount,
      workoutSummary: input.workoutSummary ?? null,
      createdAt: index >= 0 ? memoryActivity[index]!.createdAt : now,
      updatedAt: now
    };
    if (index >= 0) memoryActivity[index] = row;
    else memoryActivity.push(row);
    return row;
  }

  const [row] = await database
    .insert(dailyActivity)
    .values({
      userId: input.userId,
      activityDate: input.activityDate,
      timezone: input.timezone,
      steps: input.steps,
      goalSteps: input.goalSteps,
      distanceMeters: input.distanceMeters ?? null,
      weeklyAverage: input.weeklyAverage ?? null,
      workoutCount,
      workoutSummary: input.workoutSummary ?? null
    })
    .onConflictDoUpdate({
      target: [dailyActivity.userId, dailyActivity.activityDate],
      set: {
        timezone: input.timezone,
        steps: input.steps,
        goalSteps: input.goalSteps,
        distanceMeters: input.distanceMeters ?? null,
        weeklyAverage: input.weeklyAverage ?? null,
        workoutCount,
        workoutSummary: input.workoutSummary ?? null,
        updatedAt: new Date()
      }
    })
    .returning();
  return row;
}

export async function listDailyActivity(userId: string, fromDate: string, toDate: string) {
  if (useMemory || !database) {
    return memoryActivity
      .filter((row) => row.userId === userId && row.activityDate >= fromDate && row.activityDate <= toDate)
      .sort((a, b) => a.activityDate.localeCompare(b.activityDate));
  }
  return database
    .select()
    .from(dailyActivity)
    .where(
      and(
        eq(dailyActivity.userId, userId),
        gte(dailyActivity.activityDate, fromDate),
        lte(dailyActivity.activityDate, toDate)
      )
    )
    .orderBy(dailyActivity.activityDate);
}
