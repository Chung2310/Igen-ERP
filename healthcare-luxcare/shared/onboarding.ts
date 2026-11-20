export const APPLICATION_STATUSES = ["pending", "needs_information", "approved", "rejected", "cancelled"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export interface CompanyApplicationInput {
  companyName: string;
  taxCode?: string;
  address: string;
  phone: string;
  businessType: "service" | "recruitment" | "general";
  purpose: string;
}
export interface CompanyApplication extends CompanyApplicationInput {
  _id: string;
  userId: string;
  applicantEmail: string;
  status: ApplicationStatus;
  revision: number;
  reviewerNote?: string;
  companyCode?: string;
  workspaceCode?: string;
  createdAt: string;
  history: Array<{ status: string; actorId: string; note?: string; at: string }>;
}
export interface CompanyInvitation {
  _id: string;
  email: string;
  companyCode: string;
  companyName: string;
  branchId: string;
  status: "pending" | "accepted" | "declined" | "revoked" | "expired";
  expiresAt: string;
  createdAt: string;
}
export interface OnboardingState {
  personalAiEnabled?: boolean;
  emailVerified: boolean;
  companyCode?: string;
  applications: CompanyApplication[];
  invitations: CompanyInvitation[];
  deletionRequest?: { _id: string; status: string; dueAt: string };
}
export function needsOnboarding(user?: { role?: string; companyCode?: string } | null): boolean {
  return Boolean(
    user &&
    user.role !== "superadmin" &&
    (!user.companyCode || user.role === "trial_user") &&
    !["blog_editor", "blog_author"].includes(user.role || ""),
  );
}
export function isTrialUser(user?: { role?: string } | null): boolean {
  return user?.role === "trial_user";
}
export function isOnboardingRoute(method: string, originalUrl: string): boolean {
  const path = originalUrl.split("?")[0].replace(/\/$/, "");
  if (/^\/api\/v1\/onboarding(?:\/|$)/.test(path)) return true;
  const allowed: Record<string, string[]> = {
    "/api/v1/auth/me": ["GET"],
    "/api/v1/auth/logout": ["POST"],
    "/api/v1/auth/profile": ["PATCH"],
    "/api/v1/auth/change-password": ["POST"],
    "/api/v1/auth/delete-account": ["DELETE", "POST"],
  };
  return Boolean(allowed[path]?.includes(method.toUpperCase()));
}
