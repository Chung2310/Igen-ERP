/** Inclusive Vietnamese calendar dates, represented as an exclusive UTC end. */
export function quoteCreatedRange(from: unknown, to: unknown): { $gte: Date; $lt: Date } | undefined {
  if (from === undefined && to === undefined) return;
  const valid = (value: unknown): value is string => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (!valid(from) || !valid(to) || from > to) throw new Error("Cần đủ ngày bắt đầu và kết thúc hợp lệ, ngày bắt đầu không được sau ngày kết thúc.");
  return { $gte: new Date(`${from}T00:00:00+07:00`), $lt: new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 86400000) };
}
