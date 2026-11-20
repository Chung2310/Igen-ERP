import { browserTransport, type ServiceTransport } from "./serviceTransport";
import { parseApiErrorResponse } from "./apiClientError";
export interface CalendarItem {
  _id?: string;
  id?: string;
  companyCode: string;
  type: "event" | "leave" | "wfh" | "exception" | "reminder";
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  employeeId?: string;
  employeeName?: string;
  assigneeId?: string;
  status: "pending" | "approved" | "completed" | "active";
  creatorId: string;
  createdAt?: string;
  leaveApplicationId?: string;
}
export type CalendarItemInput = Pick<CalendarItem, "companyCode" | "type" | "title" | "startDate" | "endDate" | "status"> &
  Partial<Pick<CalendarItem, "description" | "employeeId" | "employeeName" | "assigneeId">>;
export function createHrCalendarService({ fetch, getAccessToken }: ServiceTransport) {
  async function request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (init.body) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...init, headers });
    if (!response.ok) throw await parseApiErrorResponse(response);
    return response.status === 204 ? undefined : response.json();
  }
  return {
    async list(companyCode: string): Promise<CalendarItem[]> {
      if (!companyCode.trim()) throw new Error("Mã công ty là bắt buộc.");
      const body = await request(`/api/v1/crud/hr-calendar-events?companyCode=${encodeURIComponent(companyCode)}`);
      return (body.data || []).map((item: CalendarItem) => ({ ...item, id: item._id || item.id }));
    },
    async create(input: CalendarItemInput): Promise<CalendarItem> {
      const body = await request("/api/v1/crud/hr-calendar-events", { method: "POST", body: JSON.stringify(input) });
      return body.data;
    },
    async update(id: string, input: Partial<CalendarItemInput>): Promise<CalendarItem> {
      const body = await request(`/api/v1/crud/hr-calendar-events/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
      return body.data;
    },
    async remove(id: string): Promise<void> {
      await request(`/api/v1/crud/hr-calendar-events/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };
}
export const hrCalendarService = createHrCalendarService(browserTransport);
