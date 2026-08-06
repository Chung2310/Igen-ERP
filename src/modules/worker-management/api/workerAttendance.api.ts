import { workerApiFetch } from "./client";
import type { WorkerAttendanceLog } from "../types";

export const workerAttendanceApi = {
  async mark(payload: {
    projectId: string;
    workerId: string;
    latitude?: number;
    longitude?: number;
    deviceInfo?: string;
  }) {
    return (
      await workerApiFetch<{ data: any }>("/worker-management/attendance/mark", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    ).data;
  },

  async list(projectId: string, date?: string, from?: string, to?: string) {
    const params: Record<string, string> = { projectId };
    if (date) params.date = date;
    if (from) params.from = from;
    if (to) params.to = to;

    return (
      await workerApiFetch<{ data: WorkerAttendanceLog[] }>("/worker-management/attendance", {
        params,
      })
    ).data;
  },

  async adjust(
    id: string,
    projectId: string,
    changes: { checkInAt?: string | null; checkOutAt?: string | null; note?: string }
  ) {
    return (
      await workerApiFetch<{ data: WorkerAttendanceLog }>(`/worker-management/attendance/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...changes, projectId }),
      })
    ).data;
  },

  async createQrSession(projectId: string, date: string, durationMinutes = 60) {
    return (
      await workerApiFetch<{ data: any }>("/worker-management/qr-attendance/session", {
        method: "POST",
        body: JSON.stringify({ projectId, date, durationMinutes }),
      })
    ).data;
  },

  async getQrToken(sessionId: string) {
    return (
      await workerApiFetch<{ data: any }>(`/worker-management/qr-attendance/session/${sessionId}/token`)
    ).data;
  },

  async getQrStatus(sessionId: string) {
    return (
      await workerApiFetch<{ data: any }>(`/worker-management/qr-attendance/session/${sessionId}/status`)
    ).data;
  },

  async closeQrSession(sessionId: string) {
    return (
      await workerApiFetch<{ message: string }>(`/worker-management/qr-attendance/session/${sessionId}/close`, {
        method: "POST",
      })
    );
  },
};
