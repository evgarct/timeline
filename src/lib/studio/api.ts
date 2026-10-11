"use client";

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WorkoutTemplateInput } from "@/domain/workout-templates";
import type { ExerciseFacets, ExerciseHistory, ExercisePage, ExerciseSummary, MuscleVolumeWeek, RecentWorkoutSession, StoredTemplate } from "./types";

export class ApiError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: unknown } | null;
    throw new ApiError(response.status, typeof body?.error === "string" ? body.error : `http_${response.status}`);
  }
  return response.status === 204 ? (undefined as T) : (await response.json() as T);
}

export interface CatalogFilter { query: string; muscle?: string; equipment?: string; movementPattern?: string }

export function useExerciseCatalog(filter: CatalogFilter) {
  return useInfiniteQuery({
    queryKey: ["studio", "exercises", filter],
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ page: String(pageParam), pageSize: "30", query: filter.query });
      for (const key of ["muscle", "equipment", "movementPattern"] as const) if (filter[key]) params.set(key, filter[key] as string);
      return request<ExercisePage>(`/api/exercises?${params}`);
    },
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined)
  });
}

export interface NewExerciseInput { name: string; primaryMuscles: string[]; equipment?: string }

const sameName = (a: string, b: string) => a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Creates an exercise unless one with the same name already exists. POST /api/exercises upserts by name and
 * would overwrite the existing row's metadata (secondary muscles, images, technique), and the catalog's own
 * result list may be filtered, so an unfiltered lookup decides: an existing exercise is returned untouched.
 */
export async function createExerciseIfMissing(input: NewExerciseInput): Promise<ExerciseSummary> {
  const found = await request<ExercisePage>(`/api/exercises?${new URLSearchParams({ query: input.name, pageSize: "30", includeArchived: "true" })}`);
  const existing = found.items.find((exercise) => sameName(exercise.name, input.name));
  if (existing) return existing;
  return request<ExerciseSummary>("/api/exercises", { method: "POST", body: JSON.stringify(input) });
}

export function useCreateExercise() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createExerciseIfMissing,
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: ["studio", "exercises"] }),
      client.invalidateQueries({ queryKey: ["studio", "facets"] })
    ])
  });
}

export const useExerciseFacets = () => useQuery({ queryKey: ["studio", "facets"], queryFn: () => request<ExerciseFacets>("/api/exercises/facets"), staleTime: 60_000 });

export const useTemplates = () => useQuery({ queryKey: ["studio", "templates"], queryFn: async () => (await request<{ items: StoredTemplate[] }>("/api/templates")).items });

export function useTemplateDoc(id: string | undefined) {
  return useQuery({
    queryKey: ["studio", "template", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const template = await request<StoredTemplate>(`/api/templates/${id}`);
      const ids = [...new Set(template.exercises.map((entry) => entry.exerciseId))];
      const exercises = await Promise.all(ids.map((exerciseId) => request<ExerciseSummary>(`/api/exercises/${exerciseId}`)));
      return { template, catalog: new Map(exercises.map((exercise) => [exercise.id, exercise])) };
    }
  });
}

export function useSaveTemplate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: WorkoutTemplateInput }) =>
      request<StoredTemplate>(id ? `/api/templates/${id}` : "/api/templates", { method: id ? "PUT" : "POST", body: JSON.stringify(input) }),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: ["studio", "templates"] }),
      client.invalidateQueries({ queryKey: ["studio", "template"] })
    ])
  });
}

export function useDeleteTemplate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request<void>(`/api/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["studio", "templates"] })
  });
}

export const useRecentSessions = (limit = 200) =>
  useQuery({ queryKey: ["studio", "sessions", limit], queryFn: async () => (await request<{ sessions: RecentWorkoutSession[] }>(`/api/workouts?limit=${limit}`)).sessions });

export const useMuscleVolume = (weeks = 12) =>
  useQuery({
    queryKey: ["studio", "volume", weeks],
    queryFn: async () => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return (await request<{ weeks: MuscleVolumeWeek[] }>(`/api/workouts/volume?weeks=${weeks}&timezone=${encodeURIComponent(timezone)}`)).weeks;
    }
  });

export const useExerciseHistory = (exerciseId: string | undefined, limit = 20) =>
  useQuery({ queryKey: ["studio", "history", exerciseId, limit], enabled: Boolean(exerciseId), queryFn: () => request<ExerciseHistory>(`/api/exercises/${exerciseId}/history?limit=${limit}`) });
