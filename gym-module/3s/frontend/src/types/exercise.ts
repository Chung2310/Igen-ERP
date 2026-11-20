import type { ClassifiedTrackingType, TrackingType } from './exerciseTracking';

export interface Exercise {
  [key: string]: unknown;
  _id: string;
  name: string;
  muscleGroup: string;
  muscleGroups?: string[];
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  defaultTrackingType?: TrackingType;
  equipment?: string[];
  technique?: string;
  videos?: Array<{ title: string; url: string; source: 'UPLOAD' | 'LINK' }>;
  scope: 'GLOBAL' | 'PRIVATE';
  canManage: boolean;
}

export interface AiExerciseDraft {
  name: string;
  muscleGroup: string;
  muscleGroups?: string[];
  level: Exercise['level'];
  defaultTrackingType: ClassifiedTrackingType;
  equipment: string[];
  description: string;
  technique: string;
  commonMistakes: string[];
  contraindications: string[];
  variants: string[];
}

export interface AiExerciseGenerationRequest {
  prompt: string;
}

export interface ExerciseDuplicateCheckResult {
  key: string;
  names: string[];
}

export interface MuscleGroupItem {
  _id: string;
  name: string;
  isDefault?: boolean;
  exerciseCount?: number;
}
