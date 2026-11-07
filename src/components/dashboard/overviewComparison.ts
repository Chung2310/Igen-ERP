export type ComparisonPeriod = "day" | "7" | "30" | "week" | "month" | "quarter" | "year" | "custom";

const parse = (value: string) => new Date(`${value}T12:00:00Z`);
const key = (value: Date) => value.toISOString().slice(0, 10);

export function previousComparisonRange(from: string, to: string, period: ComparisonPeriod) {
  const start = parse(from);
  const end = parse(to);
  if (period === "month") return {
    from: key(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1))),
    to: key(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 0))),
  };
  if (period === "quarter") {
    const currentQuarter = Math.floor(start.getUTCMonth() / 3) * 3;
    return {
      from: key(new Date(Date.UTC(start.getUTCFullYear(), currentQuarter - 3, 1))),
      to: key(new Date(Date.UTC(start.getUTCFullYear(), currentQuarter, 0))),
    };
  }
  if (period === "year") return {
    from: key(new Date(Date.UTC(start.getUTCFullYear() - 1, 0, 1))),
    to: key(new Date(Date.UTC(start.getUTCFullYear() - 1, 11, 31))),
  };
  if (period === "week") {
    start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7 - 7);
    const previousEnd = new Date(start);
    previousEnd.setUTCDate(previousEnd.getUTCDate() + 6);
    return { from: key(start), to: key(previousEnd) };
  }
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  start.setUTCDate(start.getUTCDate() - days);
  end.setUTCDate(end.getUTCDate() - days);
  return { from: key(start), to: key(end) };
}

export const displayComparisonDate = (value: string) => value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3-$2-$1");

export function overviewDateKey(value: string | number | Date | null | undefined) {
  if (!value) return null;
  if (typeof value === "number" || value instanceof Date) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const local = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return local ? `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}` : null;
}
