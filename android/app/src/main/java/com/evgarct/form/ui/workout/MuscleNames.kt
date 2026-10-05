package com.evgarct.form.ui.workout

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.evgarct.form.R
import java.util.Locale

private val muscleNames = mapOf(
    "chest" to R.string.muscle_chest,
    "lats" to R.string.muscle_lats,
    "upper back" to R.string.muscle_upper_back,
    "lower back" to R.string.muscle_lower_back,
    "shoulders" to R.string.muscle_shoulders,
    "biceps" to R.string.muscle_biceps,
    "triceps" to R.string.muscle_triceps,
    "forearms" to R.string.muscle_forearms,
    "abs" to R.string.muscle_abs,
    "obliques" to R.string.muscle_obliques,
    "quads" to R.string.muscle_quads,
    "hamstrings" to R.string.muscle_hamstrings,
    "glutes" to R.string.muscle_glutes,
    "calves" to R.string.muscle_calves,
    "adductors" to R.string.muscle_adductors,
    "abductors" to R.string.muscle_abductors,
    "traps" to R.string.muscle_traps,
    "neck" to R.string.muscle_neck,
    "hip flexors" to R.string.muscle_hip_flexors,
    "serratus" to R.string.muscle_serratus,
    "other" to R.string.muscle_other
)

/** Localized label for a canonical muscle id; unknown ids (user-defined) are shown as written. */
@Composable
fun muscleLabel(id: String): String =
    muscleNames[id]?.let { stringResource(it) } ?: id.replaceFirstChar { it.titlecase(Locale.getDefault()) }
