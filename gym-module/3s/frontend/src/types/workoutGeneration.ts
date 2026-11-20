export type AiWorkoutGenerationStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';

export interface AiWorkoutGenerationJob {
  id: string;
  status: AiWorkoutGenerationStatus;
  result?: unknown;
  error?: { code: string; message: string };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}
