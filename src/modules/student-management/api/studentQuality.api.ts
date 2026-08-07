import { apiFetch } from "../lib/api";
import type { StudentQualityListResponse, StudentQualityRow } from "../types";

export type StudentQualityFilters = {
  page?: number;
  limit?: number;
  search?: string;
  batchId?: string;
  courseId?: string;
  instructorId?: string;
  studentStatus?: string;
  warningLevel?: string;
  ownerFilter?: string;
};

export type StudentQualityDetail = StudentQualityRow & { miniTests: NonNullable<StudentQualityRow["latestMiniTest"]>[] };

export async function getStudentQuality(filters: StudentQualityFilters) {
  return apiFetch<StudentQualityListResponse>("/student-quality", { params: filters });
}

export async function getStudentQualityDetail(batchId: string, studentId: string) {
  const response = await apiFetch<{ success: boolean; data: StudentQualityDetail }>(`/student-quality/batches/${batchId}/students/${studentId}`);
  return response.data;
}

export async function updateStudentQuality(batchId: string, studentId: string, data: { attitudeNote: string; teacherAssessment: string }) {
  return apiFetch(`/student-quality/batches/${batchId}/students/${studentId}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function createMiniTest(batchId: string, studentId: string, data: { title: string; date: string; score: number; maxScore: number; note?: string }) {
  return apiFetch(`/student-quality/batches/${batchId}/students/${studentId}/mini-tests`, { method: "POST", body: JSON.stringify(data) });
}

export async function deleteMiniTest(batchId: string, studentId: string, miniTestId: string) {
  return apiFetch(`/student-quality/batches/${batchId}/students/${studentId}/mini-tests/${miniTestId}`, { method: "DELETE" });
}

export async function gradeStudentAssignment(batchId: string, studentId: string, assignmentId: string, data: { score: number; feedback?: string }) {
  return apiFetch(`/student-quality/batches/${batchId}/students/${studentId}/assignments/${assignmentId}`, { method: "PATCH", body: JSON.stringify(data) });
}

export type StudentQualityThresholds = { riskAttendance: number; riskAssignment: number; riskMiniTest: number; watchAttendance: number; watchAssignment: number; watchMiniTest: number; assignmentMaxScore: number; };
export async function getStudentQualityThresholds() { const response = await apiFetch<{ success: boolean; data: StudentQualityThresholds }>("/student-quality/settings/thresholds"); return response.data; }
export async function updateStudentQualityThresholds(data: StudentQualityThresholds) { return apiFetch("/student-quality/settings/thresholds", { method: "PATCH", body: JSON.stringify(data) }); }
