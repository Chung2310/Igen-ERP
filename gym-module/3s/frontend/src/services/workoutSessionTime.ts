const pad = (value: number) => String(value).padStart(2, '0');

export function localWorkoutSessionTime(now = new Date()) {
  return {
    recordedDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    recordedTime: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
}

export function workoutSessionIso(recordedDate: string, recordedTime: string): string | null {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(recordedDate);
  const time = /^(\d{2}):(\d{2})$/.exec(recordedTime);
  if (!date || !time) return null;

  const year = Number(date[1]);
  const month = Number(date[2]);
  const day = Number(date[3]);
  const hour = Number(time[1]);
  const minute = Number(time[2]);
  const value = new Date(year, month - 1, day, hour, minute);

  if (
    value.getFullYear() !== year
    || value.getMonth() !== month - 1
    || value.getDate() !== day
    || value.getHours() !== hour
    || value.getMinutes() !== minute
  ) return null;

  return value.toISOString();
}

export function formatWorkoutSessionTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
