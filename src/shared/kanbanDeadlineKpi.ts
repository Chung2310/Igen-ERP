export type KanbanDeadlineTask = {
  status: string;
  dueDate: string;
  endTime?: string;
  completedAt?: string;
};

export function parseVietnamTaskInstant(value: string): Date | undefined {
  const raw = String(value || "").trim();
  if (!raw) return undefined;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const normalized = hasZone ? raw : /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00+07:00` : `${raw}+07:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

export function calculateTaskDeadlineKpi(task: KanbanDeadlineTask) {
  if (task.status !== "Done" && task.status !== "done") return null;
  const due = parseVietnamTaskInstant(task.dueDate);
  const completed = parseVietnamTaskInstant(task.endTime || task.completedAt || "");
  if (!due || !completed) return null;
  if (completed <= due) return { status: "ontime" as const, text: "Đúng tiến độ (Đạt KPI)", diff: 0 };
  const diff = Math.max(0.1, Math.round((completed.getTime() - due.getTime()) / 360_000) / 10);
  return { status: "late" as const, text: `Trễ hạn ${diff}h`, diff };
}
