export type QualityWarningLevel = "risk" | "watch" | "good" | "unrated";

export interface QualityMetricsInput {
  attendanceRate: number | null;
  assignmentRate: number | null;
  latestMiniTestRate: number | null;
  /** Thi trượt là tín hiệu cần can thiệp độc lập với điểm danh/bài tập. */
  latestExamFailed?: boolean;
}

export interface QualityThresholds {
  riskAttendance: number; riskAssignment: number; riskMiniTest: number;
  watchAttendance: number; watchAssignment: number; watchMiniTest: number;
}

export const DEFAULT_QUALITY_THRESHOLDS: QualityThresholds = {
  riskAttendance: 50, riskAssignment: 50, riskMiniTest: 50,
  watchAttendance: 80, watchAssignment: 70, watchMiniTest: 70,
};

export function toRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function getQualityWarningLevel(metrics: QualityMetricsInput, thresholds: QualityThresholds = DEFAULT_QUALITY_THRESHOLDS): QualityWarningLevel {
  const values = [metrics.attendanceRate, metrics.assignmentRate, metrics.latestMiniTestRate]
    .filter((value): value is number => value !== null);
  if (metrics.latestExamFailed) return "risk";
  if (values.length === 0) return "unrated";
  if ((metrics.attendanceRate !== null && metrics.attendanceRate < thresholds.riskAttendance) ||
    (metrics.assignmentRate !== null && metrics.assignmentRate < thresholds.riskAssignment) ||
    (metrics.latestMiniTestRate !== null && metrics.latestMiniTestRate < thresholds.riskMiniTest)
  ) return "risk";
  if (
    (metrics.attendanceRate !== null && metrics.attendanceRate < thresholds.watchAttendance) ||
    (metrics.assignmentRate !== null && metrics.assignmentRate < thresholds.watchAssignment) ||
    (metrics.latestMiniTestRate !== null && metrics.latestMiniTestRate < thresholds.watchMiniTest)
  ) return "watch";
  return "good";
}
