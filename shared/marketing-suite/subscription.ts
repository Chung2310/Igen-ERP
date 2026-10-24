export interface AiSubscriptionPlan {
  _id: string;
  code: string;
  name: string;
  description: string;
  durationDays: number;
  aiLimit: number;
  priceVnd?: number | null;
  active: boolean;
  updatedAt: string;
}

export interface AiSubscriptionSummary {
  _id: string;
  companyCode: string;
  planId: string;
  planName: string;
  priceVnd?: number | null;
  aiLimit: number;
  carriedOver?: number;
  used: number;
  reserved: number;
  remaining: number;
  startsAt: string;
  expiresAt: string;
  status: "active" | "expired" | "cancelled" | "replaced";
}

/** Missing prices on older plans must not be displayed as free. */
export function formatAiPlanPrice(priceVnd: number | null | undefined): string {
  if (priceVnd == null) return "Chưa thiết lập giá";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(priceVnd);
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
