type RetailReportRangeInput = {
  from?: unknown;
  to?: unknown;
  preset?: unknown;
};

type RetailReportRange = {
  from: string;
  to: string;
  days: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

const badRange = () => Object.assign(new Error("Khoảng ngày báo cáo không hợp lệ."), { status: 400 });

function parseDate(value: unknown): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw badRange();
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw badRange();
  return parsed;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function currentBusinessDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function parseRetailReportRange(input: RetailReportRangeInput, today = currentBusinessDate()): RetailReportRange {
  const endOfToday = parseDate(today);
  const preset = input?.preset;
  let from = input?.from === undefined ? endOfToday : parseDate(input.from);
  let to = input?.to === undefined ? endOfToday : parseDate(input.to);

  if (preset !== undefined) {
    if (preset !== "7d" && preset !== "30d") throw badRange();
    if (input?.from !== undefined || input?.to !== undefined) throw badRange();
    const days = preset === "7d" ? 7 : 30;
    from = new Date(endOfToday.getTime() - (days - 1) * DAY_MS);
    to = endOfToday;
  }

  const count = Math.floor((to.getTime() - from.getTime()) / DAY_MS) + 1;
  if (count < 1 || count > 366) throw badRange();

  const days = Array.from({ length: count }, (_, index) => formatDate(new Date(from.getTime() + index * DAY_MS)));
  return { from: formatDate(from), to: formatDate(to), days };
}
