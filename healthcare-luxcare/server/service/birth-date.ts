const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function normalizeBirthDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("Ngày sinh không hợp lệ.");
  const match = ISO_DATE.exec(value);
  if (!match) throw new Error("Ngày sinh không hợp lệ.");
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    throw new Error("Ngày sinh không hợp lệ.");
  }
  return date;
}
