import { browserTransport, type ServiceTransport } from "./serviceTransport";
import { parseApiErrorResponse } from "./apiClientError";
import type {
  CompanyApplication,
  CompanyApplicationInput,
  CompanyInvitation,
  OnboardingState,
} from "../../shared/onboarding";
export function createOnboardingService(transport: ServiceTransport) {
  async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const send = () => {
      const headers = new Headers({ "Content-Type": "application/json" });
      const token = transport.getAccessToken();
      if (token) headers.set("Authorization", "Bearer " + token);
      return transport.fetch("/api/v1" + path, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    };
    let response = await send();
    if (response.status === 401 && transport === browserTransport && path !== "/auth/register") {
      const refreshed = await transport.fetch("/api/v1/auth/refresh-token", {
        method: "POST",
        headers: { "x-luxcare-client": "web" },
      });
      if (refreshed.ok) {
        const data = await refreshed.json();
        if (data.accessToken) {
          localStorage.setItem("accessToken", data.accessToken);
          response = await send();
        }
      }
    }
    if (!response.ok) throw await parseApiErrorResponse(response);
    const envelope = await response.json();
    return envelope.data ?? envelope;
  }
  return {
    capabilities: () =>
      request<{
        registrationEnabled: boolean;
        invitationRegistrationEnabled: boolean;
        accessModel: "organization_only";
        personalAiEnabled: boolean;
        companyWalletEnabled: boolean;
      }>("/onboarding/capabilities"),
    register: (email: string, password: string, displayName: string) =>
      request<{ registrationPending: true; email: string; companyName: string }>("/auth/register", "POST", {
        email,
        password,
        displayName,
        termsAccepted: true,
      }),
    verifyRegistration: (email: string, code: string) => request("/auth/register/verify", "POST", { email, code }),
    state: () => request<OnboardingState>("/onboarding/state"),
    resendCode: () => request("/onboarding/email/resend", "POST"),
    verifyEmail: (code: string) => request("/onboarding/email/verify", "POST", { code }),
    submit: (input: CompanyApplicationInput, previous?: CompanyApplication) =>
      request<CompanyApplication>(
        "/onboarding/applications" + (previous ? "/" + previous._id : ""),
        previous ? "PATCH" : "POST",
        { ...input, ...(previous ? { revision: previous.revision } : {}) },
      ),
    cancel: (id: string) => request("/onboarding/applications/" + id + "/cancel", "POST"),
    answerInvite: (id: string, accept: boolean) =>
      request("/onboarding/invitations/" + id + "/answer", "POST", { accept }),
    invitations: () => request<CompanyInvitation[]>("/company-invitations"),
    invite: (email: string, branchId: string) =>
      request<CompanyInvitation>("/company-invitations", "POST", { email, branchId }),
    resendInvitation: (id: string) => request("/company-invitations/" + id + "/resend", "POST"),
    revoke: (id: string) => request("/company-invitations/" + id + "/revoke", "POST"),
    cancelDeletion: () => request("/onboarding/deletion/cancel", "POST"),
  };
}
export const onboardingService = createOnboardingService(browserTransport);
