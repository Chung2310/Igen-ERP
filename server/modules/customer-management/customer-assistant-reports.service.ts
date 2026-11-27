import { CustomerSettingsService } from "./services/customer-settings.service";
import { CustomerModel } from "./models/customer.model";
import { CustomerError } from "./customer-errors";

const validDateOnly = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};

function vietnamToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now);
}

function addDays(dateOnly: string, offset: number) {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export async function customerTierCounts(companyCode: string) {
  const code = String(companyCode || "").trim().toUpperCase();
  if (!code) throw new CustomerError("CUSTOMER_COMPANY_REQUIRED", "Thiếu phạm vi doanh nghiệp để thống kê hạng khách hàng.", 400);
  const [settings, grouped] = await Promise.all([
    CustomerSettingsService.getSettings(code),
    CustomerModel.aggregate([
      { $match: { companyCode: code } },
      { $group: { _id: "$tier.code", name: { $first: "$tier.name" }, count: { $sum: 1 } } },
    ]),
  ]);
  const counts = new Map<string, { code: string; name: string; count: number }>();
  for (const tier of settings.customerTiers) {
    counts.set(tier.code, { code: tier.code, name: tier.name, count: 0 });
  }
  let unranked = 0;
  for (const row of grouped) {
    const tierCode = typeof row?._id === "string" ? row._id.trim().toLowerCase() : "";
    const count = Number.isSafeInteger(row?.count) && row.count >= 0 ? row.count : 0;
    if (!tierCode) {
      unranked = count;
      continue;
    }
    const existing = counts.get(tierCode);
    counts.set(tierCode, {
      code: tierCode,
      name: existing?.name || (typeof row.name === "string" && row.name.trim() ? row.name : "Hạng chưa cấu hình"),
      count,
    });
  }
  const tiers = [...counts.values()];
  return { total: tiers.reduce((sum, tier) => sum + tier.count, 0) + unranked, tiers, unranked };
}

export async function upcomingCustomerBirthdays(companyCode: string, fromInput?: unknown, toInput?: unknown, now = new Date()) {
  const today = vietnamToday(now);
  const from = fromInput === undefined || fromInput === "" ? today : fromInput;
  const to = toInput === undefined || toInput === "" ? addDays(String(from), 29) : toInput;
  if (!validDateOnly(from) || !validDateOnly(to) || from > to) throw new CustomerError("CUSTOMER_BIRTHDAY_RANGE_INVALID", "Khoảng ngày sinh nhật không hợp lệ.", 400);
  const first = new Date(`${from}T00:00:00.000Z`).valueOf();
  const last = new Date(`${to}T00:00:00.000Z`).valueOf();
  const dayCount = Math.floor((last - first) / 86_400_000) + 1;
  if (dayCount > 90) throw new CustomerError("CUSTOMER_BIRTHDAY_RANGE_TOO_LARGE", "Khoảng tìm sinh nhật tối đa là 90 ngày.", 400);

  const dateByMonthDay = new Map<string, string>();
  for (let offset = 0; offset < dayCount; offset += 1) {
    const date = addDays(from, offset);
    const monthDay = date.slice(5);
    dateByMonthDay.set(monthDay, date);
    if (monthDay === "02-28" && new Date(Date.UTC(Number(date.slice(0, 4)), 1, 29)).getUTCMonth() !== 1) {
      dateByMonthDay.set("02-29", date);
    }
  }
  const monthDays = [...dateByMonthDay.keys()];
  const filter: Record<string, any> = {
    companyCode: String(companyCode || "").trim().toUpperCase(),
    status: "active",
    dateOfBirth: { $type: "date" },
    $expr: { $in: [{ $dateToString: { date: "$dateOfBirth", format: "%m-%d", timezone: "UTC", onNull: "" } }, monthDays] },
  };
  const [total, rows] = await Promise.all([
    CustomerModel.countDocuments(filter),
    CustomerModel.find(filter).select("name customerCode dateOfBirth").limit(501).lean(),
  ]);
  const items = rows.flatMap((row: any) => {
    const dateOfBirth = row?.dateOfBirth instanceof Date ? row.dateOfBirth : new Date(row?.dateOfBirth);
    if (!Number.isFinite(dateOfBirth.valueOf()) || typeof row?.name !== "string") return [];
    const monthDay = `${String(dateOfBirth.getUTCMonth() + 1).padStart(2, "0")}-${String(dateOfBirth.getUTCDate()).padStart(2, "0")}`;
    const birthdayDate = dateByMonthDay.get(monthDay);
    if (!birthdayDate) return [];
    return [{ name: row.name, customerCode: String(row.customerCode || ""), birthdayDate, sortKey: birthdayDate }];
  }).sort((left, right) => left.sortKey.localeCompare(right.sortKey) || left.name.localeCompare(right.name));
  return {
    from,
    to,
    total,
    truncated: total > 500,
    items: items.slice(0, 500).map(({ sortKey: _sortKey, ...item }) => item),
  };
}

export const customerAssistantReports = { customerTierCounts, upcomingCustomerBirthdays };
