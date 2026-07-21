import { getAccessToken } from "./authService";

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

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}`, ...init?.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || "Không thể xử lý lịch làm việc.");
  return payload.data as T;
}

export const companyWorkCalendarService = {
  list: (year: number, appliedOnly = false) => request<WorkCalendarDay[]>(`/api/v1/timekeeping/work-calendar?year=${year}&appliedOnly=${appliedOnly}`),
  sync: (year: number) => request<WorkCalendarDay[]>("/api/v1/timekeeping/work-calendar/sync", { method: "POST", body: JSON.stringify({ year }) }),
  create: (input: Pick<WorkCalendarDay, "date" | "name" | "dayType">) => request<WorkCalendarDay>("/api/v1/timekeeping/work-calendar", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: Partial<Pick<WorkCalendarDay, "date" | "name" | "dayType" | "isApplied" | "adminReason">>) => request<WorkCalendarDay>(`/api/v1/timekeeping/work-calendar/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
};
