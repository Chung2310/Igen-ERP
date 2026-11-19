import type { TrackingPrescription, TrackingType } from './exerciseTracking';

export interface WorkoutTemplateExercise {
  name: string;
  sets?: number;
  reps?: string;
  weight?: string;
  restSeconds?: number;
  tempo?: string;
  notes?: string;
  exerciseId?: string;
  trackingType?: TrackingType;
  prescription?: TrackingPrescription;
}

export interface WorkoutTemplateSession {
  name: string;
  exercises: WorkoutTemplateExercise[];
}

export interface WorkoutTemplate {
  _id: string;
  title: string;
  description?: string;
  level?: string;
  targetGoal?: string;
  sessions: WorkoutTemplateSession[];
  status?: string;
  version?: number;
  muscleGroups?: string[];
  defaultSets?: number;
  defaultReps?: string;
  defaultWeight?: string;
  defaultTempo?: string;
  technicalNotes?: string;
}

export interface CustomerWorkoutPlanExercise {
  name: string;
  sets?: number;
  reps?: string;
  weight?: string;
  rest?: string;
  tempo?: string;
  notes?: string;
  exerciseId?: string;
  trackingType?: TrackingType;
  prescription?: TrackingPrescription;
}

export interface CustomerWorkoutPlanSession {
  name: string;
  exercises: CustomerWorkoutPlanExercise[];
}

export interface CustomerWorkoutPlanDraft {
  customerId: string;
  title: string;
  startDate: string;
  endDate: string;
  sessions: CustomerWorkoutPlanSession[];
}

export interface CustomerWorkoutPlan extends CustomerWorkoutPlanDraft {
  [key: string]: unknown;
  _id: string;
  status: 'DRAFT' | 'PUBLISHED';
  version?: number;
}

export interface CustomerWorkoutPlanSnapshot {
  _id: string;
  title: string;
  goal: string;
  level: string;
  durationDays: number;
  lifecycleStatus: 'ACTIVE' | 'ARCHIVED';
  assignedAt: string;
  archivedAt?: string | null;
  muscleGroups?: string[];
  defaultSets?: number;
  defaultReps?: string;
  defaultWeight?: string;
  defaultTempo?: string;
  technicalNotes?: string;
  scheduledExercises?: Array<Record<string, unknown>>;
  unscheduledExercises?: Array<Record<string, unknown>>;
}

export interface CustomerWorkoutPlanState {
  active: CustomerWorkoutPlanSnapshot | null;
  history: CustomerWorkoutPlanSnapshot[];
}
