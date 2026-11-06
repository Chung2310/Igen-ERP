export type OverviewPeriod = "7" | "30" | "week" | "month" | "quarter" | "year" | "custom";

export type DailyFinanceTrend = {
  date: string;
  revenue: number;
  cost: number | null;
  expense: number;
};

type BucketKind = "day" | "week" | "month" | "quarter";
type RevenueBucket = {
  date: string;
  label: string;
  revenue: number;
  cost: number | null;
  expense: number;
  net: number | null;
};

const parseDate = (value: string) => new Date(`${value}T00:00:00Z`);
const dateKey = (value: Date) => value.toISOString().slice(0, 10);

function bucketKind(period: OverviewPeriod, from: string, to: string): BucketKind {
  if (period === "7" || period === "week") return "day";
  if (period === "month" || period === "30") return "week";
  if (period === "quarter" || period === "year") return "month";
  const days = (parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000;
  return days <= 14 ? "day" : days <= 100 ? "week" : days <= 400 ? "month" : "quarter";
}

function bucketStart(value: string, kind: BucketKind) {
  const date = parseDate(value);
  if (kind === "week") date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  if (kind === "month" || kind === "quarter") date.setUTCDate(1);
  if (kind === "quarter") date.setUTCMonth(Math.floor(date.getUTCMonth() / 3) * 3);
  return dateKey(date);
}

function nextBucket(value: string, kind: BucketKind) {
  const date = parseDate(value);
  if (kind === "day") date.setUTCDate(date.getUTCDate() + 1);
  if (kind === "week") date.setUTCDate(date.getUTCDate() + 7);
  if (kind === "month") date.setUTCMonth(date.getUTCMonth() + 1);
  if (kind === "quarter") date.setUTCMonth(date.getUTCMonth() + 3);
  return dateKey(date);
}

function bucketLabel(value: string, kind: BucketKind) {
  const date = parseDate(value);
  if (kind === "month") return `Tháng ${date.getUTCMonth() + 1}`;
  if (kind === "quarter") return `Quý ${Math.floor(date.getUTCMonth() / 3) + 1}/${date.getUTCFullYear()}`;
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function aggregateRevenueTrends(trends: DailyFinanceTrend[], period: OverviewPeriod, from: string, to: string): RevenueBucket[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || !Number.isFinite(parseDate(from).getTime()) || !Number.isFinite(parseDate(to).getTime()) || from > to) return [];
  const kind = bucketKind(period, from, to);
  const buckets = new Map<string, RevenueBucket>();
  const start = bucketStart(from, kind);
  const end = bucketStart(to, kind);
  for (let key = start, count = 0; key <= end && count < 64; key = nextBucket(key, kind), count++) {
    buckets.set(key, { date: key, label: bucketLabel(key, kind), revenue: 0, cost: 0, expense: 0, net: 0 });
  }
  for (const row of trends) {
    if (row.date < from || row.date > to) continue;
    const key = bucketStart(row.date, kind);
    const bucket = buckets.get(key) || { date: key, label: bucketLabel(key, kind), revenue: 0, cost: 0, expense: 0, net: 0 };
    bucket.revenue += row.revenue;
    bucket.cost = bucket.cost === null || row.cost === null ? null : bucket.cost + row.cost;
    bucket.expense += row.expense;
    bucket.net = bucket.cost === null ? null : bucket.revenue - bucket.cost - bucket.expense;
    buckets.set(key, bucket);
  }
  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
}
