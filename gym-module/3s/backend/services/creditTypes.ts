export const AI_TASK_TYPES = [
  'TEXT_NUTRITION',
  'TEXT_WORKOUT',
  'TEXT_ROADMAP',
  'TEXT_ASSISTANT',
  'TEXT_GENERIC',
  'OCR_INBODY',
  'IMAGE_GENERATION',
  'EMBEDDING_DOCUMENT',
  'EMBEDDING_QUERY',
] as const;

export type AiTaskType = (typeof AI_TASK_TYPES)[number];
export type AiBillingMode = 'WALLET' | 'COMPANY_PAID';

export interface AiBillingContext {
  userId: string;
  taskType: AiTaskType;
  requestKey: string;
  billingMode?: AiBillingMode;
}

export interface ProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  providerCostMicrousd?: number;
}

export interface PricingSnapshot {
  usdToVnd: number;
  vndPerCredit: number;
  markupBasisPoints: number;
  fallbackCredits: number;
  minBillableCredits: number;
  maxReservationCredits: number;
}

export interface ProviderResult<T> {
  value: T;
  usage: ProviderUsage;
  provider: string;
  model: string;
}

