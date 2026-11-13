import { parseVietnamTaskInstant } from "./kanbanDeadlineKpi";

export function calculateEstimatedTimeProgress(task: { startTime?: string; endTime?: string; estTime?: number }) {
  const started = parseVietnamTaskInstant(task.startTime || "");
  const ended = parseVietnamTaskInstant(task.endTime || "");
  const estimatedHours = Number(task.estTime);
  if (!started || !ended || ended < started || !Number.isFinite(estimatedHours) || estimatedHours <= 0) return null;

  const actualHours = (ended.getTime() - started.getTime()) / 3_600_000;
  if (actualHours <= estimatedHours) {
    return { status: "withinEstimate" as const, text: "Trong giờ dự tính", diff: Number((estimatedHours - actualHours).toFixed(1)) };
  }
  const diff = Number((actualHours - estimatedHours).toFixed(1));
  return { status: "overEstimate" as const, text: `Vượt dự tính ${diff} giờ`, diff };
}
