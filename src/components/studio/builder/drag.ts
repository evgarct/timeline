import type { ExerciseSummary } from "@/lib/studio/types";

/** MIME type used for dragging a catalog exercise onto the canvas (native HTML5 drag and drop). */
export const EXERCISE_DRAG_MIME = "application/x-form-exercise";

export function writeDraggedExercise(event: { dataTransfer: DataTransfer }, exercise: ExerciseSummary) {
  event.dataTransfer.setData(EXERCISE_DRAG_MIME, JSON.stringify(exercise));
  event.dataTransfer.effectAllowed = "copy";
}

export function hasDraggedExercise(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.types).includes(EXERCISE_DRAG_MIME);
}

export function readDraggedExercise(dataTransfer: DataTransfer): ExerciseSummary | undefined {
  try {
    const parsed = JSON.parse(dataTransfer.getData(EXERCISE_DRAG_MIME)) as Partial<ExerciseSummary>;
    return typeof parsed.id === "string" && typeof parsed.name === "string" ? (parsed as ExerciseSummary) : undefined;
  } catch {
    return undefined;
  }
}

/** Index a dragged item would be inserted at, from the cursor's Y against the card rectangles. */
export function insertionIndex(cards: Array<{ top: number; bottom: number }>, clientY: number) {
  let index = 0;
  for (const card of cards) {
    if (clientY > (card.top + card.bottom) / 2) index += 1;
  }
  return index;
}
