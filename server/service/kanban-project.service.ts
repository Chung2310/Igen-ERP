export const PROJECT_STATUSES = ["not_started", "in_progress", "paused", "completed", "cancelled"] as const;
export const PROJECT_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type ProjectProgress = { completed: number; total: number; percent: number };

export function newUploadAttachments<T extends { uploadToken?: string }>(next: T[], existing: T[]) {
  const existingTokens = new Set(existing.map((item) => item.uploadToken).filter(Boolean));
  return next.filter((item) => item.uploadToken && !existingTokens.has(item.uploadToken));
}

export function calculateProjectProgress(tasks: Array<{ status?: string }>): ProjectProgress {
  const eligible = tasks.filter((task) => task.status !== "Archived");
  const completed = eligible.filter((task) => task.status === "Done" || task.status === "done").length;
  return { completed, total: eligible.length, percent: eligible.length ? Math.round(completed * 100 / eligible.length) : 0 };
}

export function deriveProjectLifecycle(status: string, progress: ProjectProgress, now = new Date()) {
  if (status === "paused" || status === "cancelled") return null;
  if (status === "completed" && progress.total === 0) return { status: "in_progress", completedAt: null };
  if (progress.total === 0) return null;
  if (progress.completed === progress.total && status !== "completed") return { status: "completed", completedAt: now };
  if (status === "completed" && progress.completed < progress.total) return { status: "in_progress", completedAt: null };
  return null;
}

function validDate(value: unknown) {
  return value === "" || value === null || value === undefined || (typeof value === "string" && !Number.isNaN(Date.parse(value)));
}

export function validateProjectPayload(payload: any, progress?: ProjectProgress) {
  if (payload.status !== undefined && !PROJECT_STATUSES.includes(payload.status)) throw new Error("Trạng thái dự án không hợp lệ.");
  if (payload.priority !== undefined && !PROJECT_PRIORITIES.includes(payload.priority)) throw new Error("Độ ưu tiên dự án không hợp lệ.");
  if (!validDate(payload.startAt)) throw new Error("Thời gian bắt đầu không hợp lệ.");
  if (!validDate(payload.dueAt)) throw new Error("Hạn cuối không hợp lệ.");
  if (payload.startAt && payload.dueAt && Date.parse(payload.dueAt) < Date.parse(payload.startAt)) throw new Error("Hạn cuối không được trước thời gian bắt đầu.");
  if (payload.status === "completed" && (!progress || progress.total === 0 || progress.completed !== progress.total)) {
    throw new Error("Không thể hoàn thành dự án khi các công việc chưa hoàn thành.");
  }
  if (payload.attachments !== undefined) {
    if (!Array.isArray(payload.attachments)) throw new Error("Tài liệu không hợp lệ.");
    for (const item of payload.attachments) {
      if (!item?.id || !item?.name || !item?.url || !["image", "video", "audio", "file", "link"].includes(item.type)) throw new Error("Tài liệu không hợp lệ.");
      if (!/^(https?:\/\/|\/)/i.test(item.url)) throw new Error("Tài liệu liên kết phải dùng http, https hoặc đường dẫn hệ thống.");
      if (Number(item.size || 0) > 25 * 1024 * 1024) throw new Error("Tài liệu không được vượt quá 25MB.");
    }
  }
}
