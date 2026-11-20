import { browserTransport, type ServiceTransport } from "./serviceTransport";
import { parseApiErrorResponse } from "./apiClientError";
export type WorkCalendarAudit = {
  _id: string;
  action: string;
  actorId: string;
  reason?: string;
  createdAt: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

export type WorkCalendarDayType = "holiday" | "substitute_holiday" | "working_override";
export interface WorkCalendarDay {
  _id: string;
  date: string;
  name: string;
  dayType: WorkCalendarDayType;
  source: "system" | "admin";
  sourceYear: number;
  isApplied: boolean;
  adminReason?: string;
}

export function createCompanyWorkCalendarService({ fetch, getAccessToken }: ServiceTransport) {
  async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}`, ...init?.headers },
    });
    if (!response.ok) throw await parseApiErrorResponse(response);
    const payload = await response.json().catch(() => ({}));
    return payload.data as T;
  }

  return {
    list: (year: number, appliedOnly = false) =>
      request<WorkCalendarDay[]>(`/api/v1/timekeeping/work-calendar?year=${year}&appliedOnly=${appliedOnly}`),
    sync: (year: number) =>
      request<WorkCalendarDay[]>("/api/v1/timekeeping/work-calendar/sync", {
        method: "POST",
        body: JSON.stringify({ year }),
      }),
    create: (input: Pick<WorkCalendarDay, "date" | "name" | "dayType">) =>
      request<WorkCalendarDay>("/api/v1/timekeeping/work-calendar", { method: "POST", body: JSON.stringify(input) }),
    update: (
      id: string,
      input: Partial<Pick<WorkCalendarDay, "date" | "name" | "dayType" | "isApplied" | "adminReason">>,
    ) =>
      request<WorkCalendarDay>(`/api/v1/timekeeping/work-calendar/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    remove: (id: string) => request<WorkCalendarDay>(`/api/v1/timekeeping/work-calendar/${id}`, { method: "DELETE" }),
    audit: (id: string) =>
      request<WorkCalendarAudit[]>(`/api/v1/timekeeping/work-calendar/${encodeURIComponent(id)}/audit`),
  };
}
export const companyWorkCalendarService = createCompanyWorkCalendarService(browserTransport);
