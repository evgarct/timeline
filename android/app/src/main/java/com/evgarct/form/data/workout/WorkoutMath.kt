package com.evgarct.form.data.workout

import com.evgarct.form.data.models.DraftExercise
import com.evgarct.form.data.models.DraftSet
import com.evgarct.form.data.models.TemplateExerciseDto
import com.evgarct.form.data.models.TemplatePlan
import com.evgarct.form.data.models.WorkoutDraft
import com.evgarct.form.data.models.WorkoutTemplateRequest
import com.evgarct.form.data.models.WorkoutSessionRequest
import com.evgarct.form.data.models.WorkoutSetDto
import java.time.Instant
import kotlin.math.round

/** Epley estimate; only meaningful for a positive load and 1..12 reps (matches the server). */
fun estimateOneRepMaxKg(weightKg: Double, reps: Int): Double? {
    if (weightKg <= 0.0 || reps < 1 || reps > 12) return null
    return round(weightKg * (1 + reps / 30.0) * 10) / 10
}

/** Everything the lifter marked as done goes to the database, even if reps/weight were left blank. */
private fun DraftSet.isRecordable() = done

/** Reps shown greyed-out in an empty field: what was done at this set number last time, else the bottom of the range. */
fun repsHint(exercise: DraftExercise, setIndex: Int): Int? =
    exercise.lastReps.getOrNull(setIndex) ?: exercise.repMin

fun DraftSet.e1rmKg(): Double? =
    if (setType == "warmup" || weightKg == null || reps == null) null else estimateOneRepMaxKg(weightKg, reps)

fun WorkoutDraft.recordableSetCount(): Int = exercises.sumOf { exercise -> exercise.sets.count { it.isRecordable() } }

fun WorkoutDraft.tonnageKg(): Double = round(
    exercises.sumOf { exercise ->
        exercise.sets
            .filter { it.isRecordable() && it.setType != "warmup" }
            .sumOf { (it.weightKg ?: 0.0) * (it.reps ?: 0) }
    } * 10
) / 10

/** Distinct primary muscles of the exercises that actually have recorded sets, capped at the server's limit of 8. */
fun WorkoutDraft.muscleGroups(): List<String> {
    val muscles = exercises
        .filter { exercise -> exercise.sets.any { it.isRecordable() } }
        .flatMap { it.primaryMuscles }
        .distinct()
        .take(8)
    return muscles.ifEmpty { listOf("other") }
}

/**
 * Builds the idempotent POST body. Set indexes run across the whole session (not per exercise)
 * because the server orders a session's sets by index — this keeps exercise order intact.
 * Returns null when nothing was actually done.
 */
fun WorkoutDraft.toRequest(): WorkoutSessionRequest? {
    var index = 0
    val sets = exercises.flatMap { exercise: DraftExercise ->
        exercise.sets.filter { it.isRecordable() }.map { set ->
            index += 1
            WorkoutSetDto(
                exerciseId = exercise.exerciseId,
                setIndex = index,
                reps = set.reps,
                weightKg = set.weightKg,
                completed = true,
                rir = set.rir,
                setType = set.setType,
                groupId = set.groupId
            )
        }
    }
    if (sets.isEmpty()) return null
    return WorkoutSessionRequest(
        occurredAt = Instant.ofEpochMilli(startedAtMillis).toString(),
        timezone = timezone,
        muscleGroups = muscleGroups(),
        sets = sets,
        idempotencyKey = "android-workout:$id"
    )
}

/** Turns a template plan into an editable draft: prescribed set count, suggested weight prefilled, supersets kept. */
fun TemplatePlan.toDraft(
    draftId: String,
    startedAtMillis: Long,
    timezone: String,
    newId: () -> String
): WorkoutDraft = WorkoutDraft(
    id = draftId,
    startedAtMillis = startedAtMillis,
    timezone = timezone,
    exercises = exercises.map { planned ->
        DraftExercise(
            exerciseId = planned.exerciseId,
            name = planned.name,
            primaryMuscles = planned.primaryMuscles,
            sets = List(planned.sets.coerceAtLeast(1)) {
                DraftSet(id = newId(), weightKg = planned.suggestion.weightKg, groupId = planned.groupId)
            },
            lastTopWeightKg = planned.lastSets.mapNotNull { it.weightKg }.maxOrNull(),
            lastReps = planned.lastSets.mapNotNull { it.reps },
            repMin = planned.repMin,
            repMax = planned.repMax,
            targetRir = planned.targetRir,
            restSeconds = planned.restSeconds,
            suggestedWeightKg = planned.suggestion.weightKg,
            progression = planned.progression
        )
    }
)

/**
 * Saves what the lifter actually did as a reusable template. A prescription that came from a
 * template (rep range, RIR, rest, progression) is kept as is; for ad-hoc exercises the rep range is
 * derived from the logged sets. Warm-ups never count toward the set total.
 */
fun WorkoutDraft.toTemplateRequest(name: String): WorkoutTemplateRequest? {
    val trimmed = name.trim()
    if (trimmed.isEmpty() || exercises.isEmpty()) return null
    return WorkoutTemplateRequest(
        name = trimmed,
        exercises = exercises.map { exercise ->
            val working = exercise.sets.filter { it.setType != "warmup" }
            val counted = working.filter { it.done || it.reps != null }.ifEmpty { working }
            val reps = counted.mapNotNull { it.reps }.filter { it in 1..100 }
            TemplateExerciseDto(
                exerciseId = exercise.exerciseId,
                sets = counted.size.coerceIn(1, 20),
                weightKg = counted.mapNotNull { it.weightKg }.maxOrNull() ?: exercise.suggestedWeightKg,
                repMin = exercise.repMin ?: reps.minOrNull(),
                repMax = exercise.repMax ?: reps.maxOrNull(),
                targetRir = exercise.targetRir,
                restSeconds = exercise.restSeconds,
                groupId = exercise.sets.firstNotNullOfOrNull { it.groupId },
                progression = exercise.progression
            )
        }
    )
}
