import { normalizeDate } from "../../contracts";

export function resolveSettlementPeriod(anchor: string, cycle: { type: "calendar_month" | "cutoff_day"; cutoffDay?: number | null }) {
  const normalized = normalizeDate(anchor, "Ngày kỳ đối soát");
  const [year, month] = normalized.split("-").map(Number);
  if (cycle.type === "calendar_month") {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }
  const cutoffDay = Number(cycle.cutoffDay);
  const start = new Date(Date.UTC(year, month - 2, cutoffDay));
  const end = new Date(Date.UTC(year, month - 1, cutoffDay));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
