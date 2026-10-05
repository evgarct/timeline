package com.evgarct.form.data.workout

import android.content.Context
import com.evgarct.form.data.models.WorkoutDraft
import com.evgarct.form.data.models.WorkoutSessionRequest
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json

/**
 * Disk persistence for the gym flow, so a dead process or a dropped connection never loses a
 * workout: the in-progress [WorkoutDraft] survives process death, and a finished session that
 * could not be uploaded waits in a pending queue (keyed by its idempotency key) for the retry worker.
 */
class WorkoutDraftStore(context: Context) {
    private val prefs = context.getSharedPreferences("form_workout_draft", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val lock = Any()

    fun loadDraft(): WorkoutDraft? {
        val raw = prefs.getString(KEY_DRAFT, null) ?: return null
        return try {
            json.decodeFromString(WorkoutDraft.serializer(), raw)
        } catch (e: Exception) {
            null
        }
    }

    fun saveDraft(draft: WorkoutDraft?) {
        val editor = prefs.edit()
        if (draft == null) editor.remove(KEY_DRAFT)
        else editor.putString(KEY_DRAFT, json.encodeToString(WorkoutDraft.serializer(), draft))
        editor.apply()
    }

    fun pending(): List<WorkoutSessionRequest> = synchronized(lock) { readPending() }

    fun enqueue(request: WorkoutSessionRequest) = synchronized(lock) {
        val current = readPending().filterNot { it.idempotencyKey == request.idempotencyKey }
        writePending(current + request)
    }

    fun remove(idempotencyKey: String) = synchronized(lock) {
        writePending(readPending().filterNot { it.idempotencyKey == idempotencyKey })
    }

    private fun readPending(): List<WorkoutSessionRequest> {
        val raw = prefs.getString(KEY_PENDING, null) ?: return emptyList()
        return try {
            json.decodeFromString(ListSerializer(WorkoutSessionRequest.serializer()), raw)
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun writePending(list: List<WorkoutSessionRequest>) {
        prefs.edit()
            .putString(KEY_PENDING, json.encodeToString(ListSerializer(WorkoutSessionRequest.serializer()), list))
            .commit()
    }

    private companion object {
        const val KEY_DRAFT = "active_draft"
        const val KEY_PENDING = "pending_sessions"
    }
}
