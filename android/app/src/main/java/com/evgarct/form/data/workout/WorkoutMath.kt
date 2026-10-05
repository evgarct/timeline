package com.evgarct.form.data.workout

import com.evgarct.form.data.models.DraftExercise
import com.evgarct.form.data.models.DraftSet
import com.evgarct.form.data.models.WorkoutDraft
import com.evgarct.form.data.models.WorkoutSessionRequest
import com.evgarct.form.data.models.WorkoutSetDto
import java.time.Instant
import kotlin.math.round

/** Epley estimate; only meaningful for a positive load and 1..12 reps (matches the server). */
fun estimateOneRepMaxKg(weightKg: Double, reps: Int): Double? {
    if (weightKg <= 0.0 || reps < 1 || reps > 12) return null
    return round(weightKg * (1 + reps / 30.0) * 10) / 10
}

/** A set that should be sent: marked done and carrying at least reps. */
private fun DraftSet.isRecordable() = done && (reps ?: 0) > 0

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
