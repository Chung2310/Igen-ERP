const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]!));

export type CelebrationVariables = { employeeName: string; companyName: string; holidayName: string };

export function renderCelebrationTemplate(template: string, variables: CelebrationVariables): string {
  const unknown = [...template.matchAll(/{{\s*([^}]+)\s*}}/g)]
    .map((match) => match[1].trim())
    .filter((key) => !(key in variables));
  if (unknown.length) throw new Error("Bien mau khong duoc ho tro");
  return template.replace(/{{\s*(employeeName|companyName|holidayName)\s*}}/g, (_, key: keyof CelebrationVariables) => escapeHtml(variables[key]));
}

export function vietnamDateParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, month: get("month"), day: get("day"), time: `${get("hour")}:${get("minute")}` };
}

export const isCompanySendTime = (now: Date, sendTime: string) => vietnamDateParts(now).time === sendTime;
