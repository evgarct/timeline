package com.evgarct.form.data.models

import kotlinx.serialization.Serializable

/** An entry of the personal exercise catalog (`/api/exercises`). */
@Serializable
data class Exercise(
    val id: String,
    val name: String,
    val primaryMuscles: List<String> = emptyList(),
    val secondaryMuscles: List<String> = emptyList(),
    val movementPattern: String? = null,
    val equipment: String? = null,
    val images: List<String> = emptyList(),
    val isArchived: Boolean = false
)

@Serializable
data class ExercisePage(
    val items: List<Exercise> = emptyList(),
    val page: Int = 1,
    val pageSize: Int = 30,
    val hasMore: Boolean = false
)

@Serializable
data class BestSet(val date: String, val reps: Int? = null, val weightKg: Double? = null)

@Serializable
data class HistoryEntry(
    val eventId: String,
    val date: String,
    val topWeightKg: Double? = null,
    val totalReps: Int = 0,
    val bestE1rmKg: Double? = null
)

@Serializable
data class ExerciseHistory(
    val windowSessions: Int = 0,
    val bestSet: BestSet? = null,
    val bestE1rmKg: Double? = null,
    val recentSessions: List<HistoryEntry> = emptyList(),
    val lastSession: LastSession? = null
)

/** The newest logged session of an exercise: its local date (yyyy-MM-dd) and working sets in order. */
@Serializable
data class LastSession(val date: String, val sets: List<LastSetDto> = emptyList())

/** One set as sent to and returned by `/api/workouts`. */
@Serializable
data class WorkoutSetDto(
    val exerciseId: String? = null,
    val setIndex: Int,
    val reps: Int? = null,
    val weightKg: Double? = null,
    val completed: Boolean = true,
    val rir: Int? = null,
    val setType: String = "working",
    val groupId: String? = null,
    val note: String? = null
)

@Serializable
data class WorkoutSessionRequest(
    val occurredAt: String,
    val timezone: String,
    val muscleGroups: List<String>,
    val note: String? = null,
    val exertion: Int? = null,
    val mood: String? = null,
    val sets: List<WorkoutSetDto>,
    val idempotencyKey: String
)

/** End-of-workout feedback: effort 1–5, mood ("bad" | "ok" | "good"), free text. Every part is optional. */
data class WorkoutFeedback(val exertion: Int? = null, val mood: String? = null, val note: String? = null)

@Serializable
data class SessionSummary(
    val setCount: Int = 0,
    val exerciseCount: Int = 0,
    val tonnageKg: Double = 0.0
)

@Serializable
data class RecentExercise(
    val exerciseId: String,
    val name: String,
    val sets: List<WorkoutSetDto> = emptyList()
)

@Serializable
data class RecentWorkoutSession(
    val eventId: String,
    val occurredAt: String,
    val timezone: String,
    val muscleGroups: List<String> = emptyList(),
    val note: String? = null,
    val exertion: Int? = null,
    val mood: String? = null,
    val exercises: List<RecentExercise> = emptyList(),
    val summary: SessionSummary = SessionSummary()
)

@Serializable
data class RecentWorkoutsResponse(val sessions: List<RecentWorkoutSession> = emptyList())

/** Response of POST/PUT `/api/workouts`. */
@Serializable
data class WorkoutSessionResult(
    val eventId: String,
    val occurredAt: String,
    val timezone: String,
    val muscleGroups: List<String> = emptyList(),
    val sets: List<WorkoutSetDto> = emptyList(),
    val summary: SessionSummary = SessionSummary()
)

/** Hard sets per muscle for one calendar week (Monday start); secondary muscles count 0.5. */
@Serializable
data class MuscleVolumeWeek(
    val weekStart: String,
    val sets: Map<String, Double> = emptyMap(),
    val totalSets: Double = 0.0
)

@Serializable
data class MuscleVolumeResponse(val weeks: List<MuscleVolumeWeek> = emptyList())

// --- Templates (`/api/templates`) ---

@Serializable
data class ProgressionRule(val type: String = "double", val incrementKg: Double)

/** One prescribed exercise of a template, as stored (no display name). */
@Serializable
data class TemplateExerciseDto(
    val exerciseId: String,
    val sets: Int = 3,
    val weightKg: Double? = null,
    val repMin: Int? = null,
    val repMax: Int? = null,
    val targetRir: Int? = null,
    val groupId: String? = null,
    val groupLabel: String? = null,
    val progression: ProgressionRule? = null,
    val note: String? = null
)

@Serializable
data class WorkoutTemplate(
    val id: String,
    val name: String,
    val note: String? = null,
    val exercises: List<TemplateExerciseDto> = emptyList(),
    val isArchived: Boolean = false
)

@Serializable
data class WorkoutTemplatesResponse(val items: List<WorkoutTemplate> = emptyList())

/** Request body of POST `/api/templates`. */
@Serializable
data class WorkoutTemplateRequest(
    val name: String,
    val exercises: List<TemplateExerciseDto>
)

@Serializable
data class LoadSuggestion(val weightKg: Double? = null, val reason: String = "no_history")

@Serializable
data class LastSetDto(val reps: Int? = null, val weightKg: Double? = null)

@Serializable
data class PlannedExerciseDto(
    val exerciseId: String,
    val name: String,
    val primaryMuscles: List<String> = emptyList(),
    val secondaryMuscles: List<String> = emptyList(),
    val equipment: String? = null,
    val images: List<String> = emptyList(),
    val sets: Int = 3,
    val weightKg: Double? = null,
    val repMin: Int? = null,
    val repMax: Int? = null,
    val targetRir: Int? = null,
    val groupId: String? = null,
    val groupLabel: String? = null,
    val progression: ProgressionRule? = null,
    val lastDate: String? = null,
    val lastSets: List<LastSetDto> = emptyList(),
    val suggestion: LoadSuggestion = LoadSuggestion()
)

/** Response of GET `/api/templates/{id}/plan`: the next session as prescribed plus load suggestions. */
@Serializable
data class TemplatePlan(
    val id: String,
    val name: String,
    val note: String? = null,
    val exercises: List<PlannedExerciseDto> = emptyList()
)

// --- Active-workout draft (persisted locally until the session is finished and acknowledged) ---

@Serializable
data class DraftSet(
    val id: String,
    val reps: Int? = null,
    val weightKg: Double? = null,
    val rir: Int? = null,
    val setType: String = "working",
    val done: Boolean = false,
    val groupId: String? = null
)

@Serializable
data class DraftExercise(
    val exerciseId: String,
    val name: String,
    val primaryMuscles: List<String> = emptyList(),
    val sets: List<DraftSet> = emptyList(),
    val lastTopWeightKg: Double? = null,
    val bestE1rmKg: Double? = null,
    val lastReps: List<Int> = emptyList(),
    // What the card shows next to the table (filled from the plan or the exercise's history).
    val secondaryMuscles: List<String> = emptyList(),
    val equipment: String? = null,
    val images: List<String> = emptyList(),
    val lastDate: String? = null,
    val lastSets: List<LastSetDto> = emptyList(),
    // Free-text note for this exercise ("Заметки +"); uploaded as the note of its first recorded set.
    val note: String? = null,
    // Superset tab text from the template (groups themselves are the sets' groupId).
    val groupLabel: String? = null,
    // Prescription copied from a template (all optional; absent for ad-hoc exercises).
    val repMin: Int? = null,
    val repMax: Int? = null,
    val targetRir: Int? = null,
    val suggestedWeightKg: Double? = null,
    val progression: ProgressionRule? = null
)

@Serializable
data class WorkoutDraft(
    val id: String,
    val startedAtMillis: Long,
    val timezone: String,
    val exercises: List<DraftExercise> = emptyList(),
    // Shown in the screen header: the template's name when started from one.
    val title: String? = null
)
