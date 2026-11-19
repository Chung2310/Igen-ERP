import type { PaginationMeta } from '../types';

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiList<T> extends ApiSuccess<T[]> {
  meta: PaginationMeta;
}

export interface ApiFailure {
  success: false;
  message: string;
  code: string;
  requestId: string;
  errors?: FieldError[];
}

export type FeatureKey =
  | 'OCR_INBODY'
  | 'ROADMAP'
  | 'EXERCISE_LIBRARY'
  | 'PROGRESS'
  | 'CARE'
  | 'DASHBOARD'
  | 'NUTRITION_AI'
  | 'PT_ASSISTANT';

export type FeatureState = Partial<Record<FeatureKey, boolean>>;
