export interface PersonalAiStatus {
  mode: "personal-free";
  limits: { hour: number; day: number; month: number };
  used: { hour: number; day: number; month: number };
  remaining: { hour: number; day: number; month: number };
  resetAt: string | null;
  dayResetAt: string;
  monthResetAt: string;
}
export interface PersonalAiMessage { id: string; question: string; answer: string; createdAt: string }
export interface CompanyWalletState {
  companyCode: string;
  balance: number;
  transactions: Array<{ _id: string; amount: number; type: "deposit" | "payment" | "withdraw";
    status: "pending" | "success" | "failed"; description?: string; createdAt: string; orderCode: number }>;
}
