export interface RoadmapNutritionStrategy {
  bmr?: number;
  tdee?: number;
  targetCalories?: number;
  calorieDeficitOrSurplus?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  waterLiters?: number;
  advice?: string;
  [key: string]: unknown;
}

export interface RoadmapEvaluationCheckpoint {
  week: number;
  title: string;
  description: string;
}

export interface RoadmapSession {
  sessionNumber?: number;
  name?: string;
  focus?: string;
  exercises?: string[];
  [key: string]: unknown;
}

export interface RoadmapPhaseWeek {
  week: number;
  focus: string;
  sessionTargets?: number | null;
  sessions?: RoadmapSession[];
}

export interface RoadmapPhase {
  order: number;
  name: string;
  durationWeeks: number;
  goals?: string[];
  weeks: RoadmapPhaseWeek[];
}

export interface RoadmapStrategy {
  sessionBudget?: { warmupMinutes: number; strengthMinutes: number; cardioMinutes: number; cooldownMinutes: number };
  generationSource?: 'AI' | 'TEMPLATE';
  assumptions?: string[];
  targetSummary?: string;
  estimatedWeeks?: number;
  sessionsPerWeek?: number;
  trainingMethod?: string;
  trainingSplit?: string;
  cardioProtocol?: string;
  nutrition?: RoadmapNutritionStrategy;
  checkpoints?: RoadmapEvaluationCheckpoint[];
  goal?: string;
  durationWeeks?: number;
  trainingStyle?: string;
  focusAreas?: string[];
  nutritionStrategy?: string;
  [key: string]: unknown;
}

export type RoadmapBaseline = Record<string, number | undefined>;

export interface Roadmap {
  _id: string;
  customerId: string;
  ptId?: string;
  title: string;
  baseline?: RoadmapBaseline;
  strategy?: RoadmapStrategy;
  phases: RoadmapPhase[];
  status: 'DRAFT' | 'PUBLISHED';
  version: number;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
