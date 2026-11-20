import type {
  CustomerWorkoutPlanDraft,
  WorkoutTemplate,
} from '../types/workout';
import { normalizePlanExercise } from '../utils/exerciseTracking';

export function workoutTemplateToDraft(template: WorkoutTemplate): CustomerWorkoutPlanDraft {
  return {
    customerId: '',
    title: template.title,
    startDate: '',
    endDate: '',
    sessions: template.sessions.map((session) => ({
      name: session.name,
      exercises: session.exercises.map((exercise) => {
        const normalized = normalizePlanExercise(exercise);
        return {
          name: normalized.name,
          ...(normalized.exerciseId ? { exerciseId: normalized.exerciseId } : {}),
          trackingType: normalized.trackingType,
          prescription: { ...normalized.prescription },
        };
      }),
    })),
  };
}
