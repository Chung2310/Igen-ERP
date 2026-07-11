import type { WorkflowStep } from "../../../types";

export type StepSchedulePreview = {
  stepId: string;
  title: string;
  start: Date;
  due: Date | null;
  durationDays: number | null;
};

export const getStepDurationDays = (step: WorkflowStep): number | null => {
  if (step.estDays && step.estDays > 0) return step.estDays;
  switch (step.deadlineType) {
    case "same_day":
    case "custom_time": return 0;
    case "after_1": return 1;
    case "after_2": return 2;
    case "after_x": return step.deadlineDays || 3;
    default: return null;
  }
};

const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

const addWorkingDays = (from: Date, days: number): Date => {
  const date = new Date(from);
  while (isWeekend(date)) date.setDate(date.getDate() + 1);
  for (let remaining = days; remaining > 0;) {
    date.setDate(date.getDate() + 1);
    if (!isWeekend(date)) remaining--;
  }
  return date;
};

const nextWorkingDay = (from: Date): Date => {
  const date = new Date(from);
  do date.setDate(date.getDate() + 1); while (isWeekend(date));
  return date;
};

/** Builds the same working-day schedule used by the workflow task generator. */
export const buildStepSchedulePreview = (steps: WorkflowStep[], startDate?: string): StepSchedulePreview[] => {
  let cursor = startDate && /^\d{4}-\d{2}-\d{2}/.test(startDate)
    ? new Date(`${startDate.slice(0, 10)}T08:00:00`)
    : new Date();
  if (Number.isNaN(cursor.getTime())) cursor = new Date();

  return steps.map((step) => {
    const durationDays = getStepDurationDays(step);
    const start = new Date(cursor);
    while (isWeekend(start)) start.setDate(start.getDate() + 1);
    if (start.getDay() === 1 && isWeekend(cursor)) start.setHours(8, 0, 0, 0);
    if (durationDays === null) return { stepId: step.id, title: step.title, start, due: null, durationDays };

    let due = addWorkingDays(start, durationDays);
    if (step.deadlineTime?.includes(":")) {
      const [hours, minutes] = step.deadlineTime.split(":");
      due.setHours(Number(hours), Number(minutes), 0, 0);
    } else due.setHours(18, 0, 0, 0);
    if (due < start) due = nextWorkingDay(due);
    cursor = new Date(due);
    return { stepId: step.id, title: step.title, start, due, durationDays };
  });
};

export const toDateInputValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const fmtScheduleDatetime = (date: Date) =>
  `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;