function validMessageDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function messageLocalDateKey(value?: string): string {
  const date = validMessageDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function messageDateLabel(value?: string, today = new Date()): string {
  const date = validMessageDate(value);
  if (!date) return "";
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (messageLocalDateKey(value) === messageLocalDateKey(today.toISOString())) return "Hôm nay";
  if (messageLocalDateKey(value) === messageLocalDateKey(yesterday.toISOString())) return "Hôm qua";
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
}

export function messageTimeLabel(value?: string): string {
  const date = validMessageDate(value);
  return date ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date) : "";
}
