import { superAdminRequest } from "./superAdminRequest";

export type SuperAdminAssistantFeedback = {
  companyCode: string;
  branchId: string;
  branchName: string;
  userName?: string;
  userEmail?: string;
  question?: string;
  answer: string;
  rating: number;
  comment?: string;
  submittedAt: string;
};

export type SuperAdminAssistantFeedbackFilters = {
  from?: string;
  to?: string;
  companyCode?: string;
  branchId?: string;
  rating?: number;
  search?: string;
  page?: number;
  limit?: number;
};

export type SuperAdminAssistantFeedbackReport = {
  items: SuperAdminAssistantFeedback[];
  total: number;
  page: number;
  limit: number;
  summary: { total: number; averageRating: number; lowRatingCount: number };
};

export type SuperAdminFeedbackBranch = { id: string; code: string; name: string };

export const superAdminAssistantFeedbackService = {
  report: (filters: SuperAdminAssistantFeedbackFilters, signal?: AbortSignal) => {
    const query = new URLSearchParams({ page: String(filters.page || 1), limit: String(filters.limit || 20) });
    if (filters.from) query.set("from", filters.from);
    if (filters.to) query.set("to", filters.to);
    if (filters.companyCode) query.set("companyCode", filters.companyCode);
    if (filters.branchId) query.set("branchId", filters.branchId);
    if (filters.rating) query.set("rating", String(filters.rating));
    if (filters.search?.trim()) query.set("search", filters.search.trim());
    return superAdminRequest(`/api/v1/super-admin/assistant-feedback/reports?${query.toString()}`, { signal }) as Promise<SuperAdminAssistantFeedbackReport>;
  },
  branches: async (companyCode: string, signal?: AbortSignal) => {
    if (!companyCode) return [];
    const query = new URLSearchParams({ companyCode });
    const result = await superAdminRequest(`/api/v1/super-admin/assistant-feedback/branches?${query}`, { signal });
    return (result.branches || []) as SuperAdminFeedbackBranch[];
  },
};
