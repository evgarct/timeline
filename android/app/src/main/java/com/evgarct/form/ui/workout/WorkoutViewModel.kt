package com.evgarct.form.ui.workout

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.evgarct.form.FormApp
import com.evgarct.form.data.models.DraftExercise
import com.evgarct.form.data.models.DraftSet
import com.evgarct.form.data.models.MuscleVolumeWeek
import com.evgarct.form.data.models.Exercise
import com.evgarct.form.data.models.RecentWorkoutSession
import com.evgarct.form.data.models.WorkoutTemplate
import com.evgarct.form.data.models.WorkoutDraft
import com.evgarct.form.data.models.WorkoutFeedback
import com.evgarct.form.data.repository.WorkoutRepository
import com.evgarct.form.data.workout.repsHint
import com.evgarct.form.data.workout.toDraft
import com.evgarct.form.data.workout.toRequest
import com.evgarct.form.data.workout.toTemplateRequest
import com.evgarct.form.work.WorkoutSyncWorker
import kotlinx.coroutines.launch
import java.util.TimeZone
import java.util.UUID

enum class FinishOutcome { NOTHING_LOGGED, SAVED }

enum class TemplateMessage { SAVED, SAVE_FAILED, START_FAILED }

/**
 * State holder for the Training tab. The active [WorkoutDraft] is written to disk after every
 * mutation, so killing the app mid-workout loses nothing; finishing first moves the session into
 * the durable pending queue and only then tries the network.
 */
class WorkoutViewModel : ViewModel() {

    private val app = FormApp.instance
    private val repository = app.workoutRepository
    private val store = repository.draftStore

    var draft by mutableStateOf(store.loadDraft())
        private set

    var recent by mutableStateOf<List<RecentWorkoutSession>>(emptyList())
        private set

    var volume by mutableStateOf<List<MuscleVolumeWeek>>(emptyList())
        private set

    var templates by mutableStateOf<List<WorkoutTemplate>>(emptyList())
        private set

    var startingTemplateId by mutableStateOf<String?>(null)
        private set

    var templateMessage by mutableStateOf<TemplateMessage?>(null)
        private set

    var isLoading by mutableStateOf(false)
        private set

    var loadFailed by mutableStateOf(false)
        private set

    var pendingCount by mutableStateOf(store.pending().size)
        private set

    var isFinishing by mutableStateOf(false)
        private set

    fun refresh() {
        if (isLoading) return
        viewModelScope.launch {
            isLoading = true
            if (store.pending().isNotEmpty()) repository.flushPending()
            pendingCount = store.pending().size
            repository.muscleVolume(2, TimeZone.getDefault().id).onSuccess { volume = it }
            repository.templates().onSuccess { templates = it }
            repository.recentSessions()
                .onSuccess { recent = it; loadFailed = false }
                .onFailure { loadFailed = true }
            isLoading = false
        }
    }

    fun startWorkout() {
        if (draft != null) return
        commit(WorkoutDraft(
            id = UUID.randomUUID().toString(),
            startedAtMillis = System.currentTimeMillis(),
            timezone = TimeZone.getDefault().id
        ))
    }

    /** Starts a session from a template: prescribed sets, last-time sets and a progression-based weight suggestion. */
    fun startFromTemplate(templateId: String) {
        if (draft != null || startingTemplateId != null) return
        startingTemplateId = templateId
        viewModelScope.launch {
            repository.templatePlan(templateId)
                .onSuccess { plan ->
                    plan.exercises.forEach { preloadImages(it.images) }
                    commit(plan.toDraft(
                        draftId = UUID.randomUUID().toString(),
                        startedAtMillis = System.currentTimeMillis(),
                        timezone = TimeZone.getDefault().id,
                        newId = { UUID.randomUUID().toString() }
                    ))
                }
                .onFailure { templateMessage = TemplateMessage.START_FAILED }
            startingTemplateId = null
        }
    }

    fun saveAsTemplate(name: String) {
        val request = draft?.toTemplateRequest(name) ?: return
        viewModelScope.launch {
            repository.saveTemplate(request)
                .onSuccess { saved ->
                    templates = listOf(saved) + templates.filterNot { it.id == saved.id }
                    templateMessage = TemplateMessage.SAVED
                }
                .onFailure { templateMessage = TemplateMessage.SAVE_FAILED }
        }
    }

    fun dismissTemplateMessage() {
        templateMessage = null
    }

    fun discardDraft() {
        commit(null)
    }

    fun addExercise(exercise: Exercise) {
        val current = draft ?: return
        if (current.exercises.any { it.exerciseId == exercise.id }) return
        commit(current.copy(exercises = current.exercises + DraftExercise(
            exerciseId = exercise.id,
            name = exercise.name,
            primaryMuscles = exercise.primaryMuscles,
            secondaryMuscles = exercise.secondaryMuscles,
            equipment = exercise.equipment,
            images = exercise.images,
            instructions = exercise.instructions,
            sets = listOf(newSet())
        )))
        preloadImages(exercise.images)
        // Prefill from the last session without blocking the UI; a failure just leaves empty fields.
        viewModelScope.launch {
            repository.exerciseHistory(exercise.id).onSuccess { history ->
                val top = history.recentSessions.firstOrNull()?.topWeightKg
                updateExercise(exercise.id) { entry ->
                    entry.copy(
                        lastTopWeightKg = top,
                        bestE1rmKg = history.bestE1rmKg,
                        lastDate = history.lastSession?.date,
                        lastSets = history.lastSession?.sets.orEmpty(),
                        lastReps = history.lastSession?.sets.orEmpty().mapNotNull { it.reps },
                        sets = entry.sets.mapIndexed { index, set ->
                            if (set.done) set else set.copy(
                                weightKg = set.weightKg ?: top,
                                reps = set.reps ?: history.lastSession?.sets?.getOrNull(index)?.reps
                            )
                        }
                    )
                }
            }
        }
    }

    fun removeExercise(exerciseId: String) {
        val current = draft ?: return
        commit(current.copy(exercises = current.exercises.filterNot { it.exerciseId == exerciseId }))
    }

    fun addSet(exerciseId: String) = updateExercise(exerciseId) { entry ->
        val previous = entry.sets.lastOrNull { it.setType == "working" } ?: entry.sets.lastOrNull()
        entry.copy(sets = entry.sets + newSet().copy(
            reps = previous?.reps,
            weightKg = previous?.weightKg,
            groupId = entry.sets.firstOrNull()?.groupId
        ))
    }

    fun removeSet(exerciseId: String, setId: String) = updateExercise(exerciseId) { entry ->
        entry.copy(sets = entry.sets.filterNot { it.id == setId })
    }

    fun updateSet(exerciseId: String, setId: String, change: (DraftSet) -> DraftSet) = updateExercise(exerciseId) { entry ->
        entry.copy(sets = entry.sets.map { if (it.id == setId) change(it) else it })
    }

    fun toggleDone(exerciseId: String, setId: String) {
        var becameDone = false
        val hint = draft?.exercises?.firstOrNull { it.exerciseId == exerciseId }?.let { entry ->
            repsHint(entry, entry.sets.indexOfFirst { it.id == setId })
        }
        updateSet(exerciseId, setId) { set ->
            becameDone = !set.done
            // Marking a set done without typing reps records the visible hint (last time / bottom of the range).
            set.copy(done = !set.done, reps = if (becameDone) set.reps ?: hint else set.reps)
        }
    }

    /** The exercise's check circle: marks every set done (filling reps from the hint), or clears them all if already complete. */
    fun toggleExerciseDone(exerciseId: String) = updateExercise(exerciseId) { entry ->
        val allDone = entry.sets.isNotEmpty() && entry.sets.all { it.done }
        entry.copy(sets = entry.sets.mapIndexed { index, set ->
            if (allDone) set.copy(done = false)
            else set.copy(done = true, reps = set.reps ?: repsHint(entry, index))
        })
    }

    fun updateNote(exerciseId: String, note: String) = updateExercise(exerciseId) { it.copy(note = note.ifEmpty { null }) }

    /** Warms Coil's cache when a workout starts, so photos are already there in a gym with bad reception. */
    private fun preloadImages(urls: List<String>) {
        val loader = coil.Coil.imageLoader(app)
        urls.forEach { url ->
            loader.enqueue(coil.request.ImageRequest.Builder(app).data(url).build())
        }
    }

    /** Links the exercise at [index] with the next one as a superset, or unlinks them if already linked. */
    fun toggleSupersetWithNext(index: Int) {
        val current = draft ?: return
        val first = current.exercises.getOrNull(index) ?: return
        val second = current.exercises.getOrNull(index + 1) ?: return
        val firstGroup = first.sets.firstOrNull()?.groupId
        val linked = firstGroup != null && firstGroup == second.sets.firstOrNull()?.groupId
        val groupId = if (linked) null else firstGroup ?: "g${UUID.randomUUID().toString().take(6)}"
        val previousShares = index > 0 && current.exercises[index - 1].sets.firstOrNull()?.groupId == firstGroup && firstGroup != null
        commit(current.copy(exercises = current.exercises.mapIndexed { i, entry ->
            when {
                i == index + 1 -> entry.withGroup(groupId)
                i == index && (!linked || !previousShares) -> entry.withGroup(groupId)
                else -> entry
            }
        }))
    }

    fun finish(feedback: WorkoutFeedback = WorkoutFeedback()): FinishOutcome {
        val current = draft ?: return FinishOutcome.NOTHING_LOGGED
        val request = current.toRequest(feedback) ?: return FinishOutcome.NOTHING_LOGGED
        // Durable first: from here on a crash or a dead connection cannot lose the session.
        store.enqueue(request)
        pendingCount = store.pending().size
        commit(null)
        isFinishing = true
        viewModelScope.launch {
            val result = repository.submit(request)
            if (result.isSuccess) {
                store.remove(request.idempotencyKey)
            } else if (result.exceptionOrNull()?.let(WorkoutRepository::isRetryable) != false) {
                WorkoutSyncWorker.enqueue(app)
            }
            pendingCount = store.pending().size
            isFinishing = false
            if (result.isSuccess) refresh()
        }
        return FinishOutcome.SAVED
    }

    fun deleteSession(eventId: String) {
        viewModelScope.launch {
            repository.deleteSession(eventId).onSuccess { recent = recent.filterNot { it.eventId == eventId } }
        }
    }

    private fun DraftExercise.withGroup(groupId: String?) = copy(sets = sets.map { it.copy(groupId = groupId) })

    private fun newSet() = DraftSet(id = UUID.randomUUID().toString())

    private fun updateExercise(exerciseId: String, change: (DraftExercise) -> DraftExercise) {
        val current = draft ?: return
        commit(current.copy(exercises = current.exercises.map { if (it.exerciseId == exerciseId) change(it) else it }))
    }

    private fun commit(next: WorkoutDraft?) {
        draft = next
        store.saveDraft(next)
    }

}
