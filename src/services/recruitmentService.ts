import { getAccessToken } from "./authService";
import type { RecruitmentApplicant, RecruitmentAttachment, RecruitmentHistory, RecruitmentInterview, RecruitmentJob, RecruitmentPipeline } from "../types/recruitment";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = init.body instanceof FormData;
  const response = await fetch(`/api/v1/recruitment${path}`, {
    ...init,
    headers: { ...(isForm ? {} : { "Content-Type": "application/json" }), Authorization: `Bearer ${getAccessToken()}`, ...(init.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(body.message || "Không thể xử lý yêu cầu tuyển dụng.") as Error & { status?: number }; error.status = response.status; throw error; }
  return body.data ?? body;
}
const query = (filters: Record<string, unknown> = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== "") params.set(key, String(value)); });
  const value = params.toString(); return value ? `?${value}` : "";
};
const json = (method: string, value?: unknown): RequestInit => ({ method, body: value === undefined ? undefined : JSON.stringify(value) });

export const recruitmentApi = {
  listJobs: (filters?: Record<string, unknown>) => request<RecruitmentJob[]>(`/jobs${query(filters)}`),
  createJob: (value: Partial<RecruitmentJob>) => request<RecruitmentJob>("/jobs", json("POST", value)),
  updateJob: (id: string, value: Partial<RecruitmentJob> & { version: number }) => request<RecruitmentJob>(`/jobs/${id}`, json("PATCH", value)),
  changeJobStatus: (id: string, version: number, status: RecruitmentJob["status"]) => request<RecruitmentJob>(`/jobs/${id}/status`, json("POST", { version, status })),
  deleteJob: (id: string, version: number) => request(`/jobs/${id}/delete`, json("POST", { version })),
  restoreJob: (id: string, version: number) => request(`/jobs/${id}/restore`, json("POST", { version })),
  getPipeline: () => request<RecruitmentPipeline>("/pipeline"),
  savePipeline: (version: number, stages: RecruitmentPipeline["stages"]) => request<RecruitmentPipeline>("/pipeline", json("PUT", { version, stages })),
  listApplicants: (filters?: Record<string, unknown>) => request<RecruitmentApplicant[]>(`/applicants${query(filters)}`),
  createApplicant: (value: Partial<RecruitmentApplicant> & { jobId: string; fullName: string; confirmDuplicate?: boolean }) => request<any>("/applicants", json("POST", value)),
  updateApplicant: (id: string, value: Partial<RecruitmentApplicant> & { version: number }) => request<RecruitmentApplicant>(`/applicants/${id}`, json("PATCH", value)),
  transitionApplicant: (id: string, version: number, stageId: string, note = "") => request<RecruitmentApplicant>(`/applicants/${id}/transition`, json("POST", { version, stageId, note })),
  applicantHistory: (id: string) => request<RecruitmentHistory[]>(`/applicants/${id}/history`),
  listInterviews: (filters?: Record<string, unknown>) => request<RecruitmentInterview[]>(`/interviews${query(filters)}`),
  createInterview: (value: Partial<RecruitmentInterview>) => request<RecruitmentInterview>("/interviews", json("POST", value)),
  updateInterview: (id: string, value: Partial<RecruitmentInterview> & { version: number }) => request<RecruitmentInterview>(`/interviews/${id}`, json("PATCH", value)),
  getJobAttachment: (jobId: string) => request<RecruitmentAttachment | null>(`/jobs/${jobId}/attachment`),
  uploadJobAttachment: (jobId: string, file: File, version?: number) => { const form = new FormData(); form.append("file", file); if (version !== undefined) form.append("version", String(version)); return request<RecruitmentAttachment>(`/jobs/${jobId}/attachment`, { method: "POST", body: form }); },
  getApplicantAttachment: (applicantId: string) => request<RecruitmentAttachment | null>(`/applicants/${applicantId}/attachment`),
  uploadApplicantAttachment: (applicantId: string, file: File, version?: number) => { const form = new FormData(); form.append("file", file); if (version !== undefined) form.append("version", String(version)); return request<RecruitmentAttachment>(`/applicants/${applicantId}/attachment`, { method: "POST", body: form }); },
  uploadAttachment: (applicantId: string, file: File) => recruitmentApi.uploadApplicantAttachment(applicantId, file),
  listAttachments: async (applicantId: string) => { const file = await recruitmentApi.getApplicantAttachment(applicantId); return file ? [file] : []; },
  downloadAttachment: (id: string) => request<{ signedUrl: string; originalName: string }>(`/attachments/${id}/download`),
  deleteAttachment: (id: string) => request(`/attachments/${id}`, { method: "DELETE" }),
};
