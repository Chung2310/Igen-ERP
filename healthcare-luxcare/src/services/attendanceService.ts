import { browserTransport, type ServiceTransport } from "./serviceTransport";
import { parseApiErrorResponse } from "./apiClientError";
import type { AttendanceOverviewLog } from "../types/attendance";
export type AttendanceLog = AttendanceOverviewLog & { _id: string; note?: string };
export type AttendanceAdjustment = {
  _id: string;
  actorName?: string;
  actorId: string;
  createdAt: string;
  reason: string;
  before: Partial<AttendanceLog>;
  after: Partial<AttendanceLog>;
};
export type TodayAttendance = {
  log: AttendanceLog | null;
  workCalendar: { date: string; isWorkingDay: boolean; label?: string };
};
export type WorkShift = {
  _id: string;
  code: string;
  name: string;
  color: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  checkInFrom?: string | null;
  checkInUntil?: string | null;
  checkOutFrom?: string | null;
  checkOutUntil?: string | null;
  standardMinutes?: number;
  workingDays: number[];
  allowedLateMinutes: number;
  allowedEarlyLeaveMinutes: number;
  isDefault: boolean;
  isActive: boolean;
  employeeCount?: number;
  breakPeriods?: { name: string; startTime: string; endTime: string; paid: boolean }[];
};
export type ShiftInput = Omit<WorkShift, "_id" | "employeeCount">;
export type ShiftEmployee = {
  _id: string;
  displayName?: string;
  email: string;
  department?: string;
  assignment?: { shiftId: string; effectiveFrom: string; effectiveTo?: string; daysOfWeek: number[] } | null;
};
export type ShiftAssignmentInput = {
  employeeIds: string[];
  shiftId: string;
  effectiveFrom: string;
  effectiveTo?: string;
  daysOfWeek: number[];
};
export function createAttendanceService({ fetch, getAccessToken }: ServiceTransport) {
  async function get<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers();
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (init.body) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...init, headers });
    if (!response.ok) throw await parseApiErrorResponse(response);
    return (await response.json()).data;
  }
  return {
    today: () => get<TodayAttendance>("/api/v1/timekeeping/today"),
    adjustments: (id: string) =>
      get<AttendanceAdjustment[]>(`/api/v1/crud/timekeeping-logs/${encodeURIComponent(id)}/adjustments`),
    adjust: (id: string, input: { status?: string; note?: string; adjustmentReason: string }) =>
      get<AttendanceLog>(`/api/v1/crud/timekeeping-logs/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    history: async (uid: string, companyCode: string, startDate: string, endDate: string) => {
      const query = new URLSearchParams({ employeeId: uid, companyCode, startDate, endDate, limit: "10000" });
      const rows = await get<AttendanceLog[]>(`/api/v1/crud/timekeeping-logs?${query}`);
      return rows.filter((row) => row.uid === uid);
    },
    shifts: () => get<WorkShift[]>("/api/v1/timekeeping/shifts"),
    createShift: (input: ShiftInput) =>
      get<WorkShift>("/api/v1/timekeeping/shifts", { method: "POST", body: JSON.stringify(input) }),
    updateShift: (id: string, input: Partial<ShiftInput>) =>
      get<WorkShift>(`/api/v1/timekeeping/shifts/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    removeShift: async (id: string) => {
      await get(`/api/v1/timekeeping/shifts/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    assignments: () => get<ShiftEmployee[]>("/api/v1/timekeeping/shift-assignments"),
    assign: (input: ShiftAssignmentInput) =>
      get("/api/v1/timekeeping/shift-assignments", { method: "POST", body: JSON.stringify(input) }),
  };
}
export const attendanceService = createAttendanceService(browserTransport);
