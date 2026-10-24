export interface AiSubscriptionPlan {
  _id: string;
  code: string;
  name: string;
  description: string;
  durationDays: number;
  aiLimit: number;
  active: boolean;
  updatedAt: string;
}

export interface AiSubscriptionSummary {
  _id: string;
  companyCode: string;
  planId: string;
  planName: string;
  aiLimit: number;
  used: number;
  reserved: number;
  remaining: number;
  startsAt: string;
  expiresAt: string;
  status: "active" | "expired" | "cancelled" | "replaced";
}

export interface CampaignAiEstimate {
  totalSlots: number;
  planningCalls: number;
  researchCalls: number;
  verificationCalls: number;
  candidateCalls: number;
  imageCalls: number;
  captionCalls: number;
  estimatedCalls: number;
  maximumCalls: number;
  remaining: number;
}
