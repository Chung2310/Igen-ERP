import { CompanyWorkCalendarDayModel } from "../../../model/company-work-calendar.model";
import { User } from "../models/user.model";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Chặn vòng lặp chạy vô hạn khi dữ liệu ngày bị hỏng */
const MAX_SESSION_ITERATIONS = 400;

/** Đếm số buổi học viên đã dùng; một buổi chỉ tính tối đa một lần. */
export function countConsumedSessions(
  sessions: Array<{ records: Array<{ studentId: string; status: string }> }>,
  studentId: string,
): number {
  return sessions.filter((session) => session.records.some(
    (record) => record.studentId === studentId && ["present", "late"].includes(record.status),
  )).length;
}

/**
 * Liệt kê các ngày có buổi học theo lịch của lớp, bỏ các ngày nghỉ lễ.
 * Đây là nguồn duy nhất để đếm buổi — lịch, cảnh báo tiến độ và hạn mức
 * buổi của học viên đều gọi hàm này để không lệch nhau.
 */
export function listScheduledSessionDates(
  startDate: string,
  endDate: string,
  daysOfWeek: number[],
  holidaySet: Set<string> = new Set()
): string[] {
  if (!DATE_PATTERN.test(startDate || "") || !DATE_PATTERN.test(endDate || "")) return [];
  if (startDate > endDate) return [];

  const days = Array.isArray(daysOfWeek) ? daysOfWeek : [];
  if (days.length === 0) return [];

  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  for (let i = 0; cursor <= end && i < MAX_SESSION_ITERATIONS; i++, cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (!days.includes(cursor.getUTCDay())) continue;
    const date = cursor.toISOString().slice(0, 10);
    if (holidaySet.has(date)) continue;
    dates.push(date);
  }

  return dates;
}

/** Tổng số buổi theo lịch của cả lớp */
export function countTotalSessions(
  startDate: string,
  endDate: string,
  daysOfWeek: number[],
  holidaySet?: Set<string>
): number {
  return listScheduledSessionDates(startDate, endDate, daysOfWeek, holidaySet).length;
}

/**
 * Số buổi còn lại tính từ hôm nay (tính cả hôm nay) tới ngày kết thúc.
 * Lớp đã quá ngày kết thúc trả về 0.
 */
export function countRemainingSessions(
  today: string,
  endDate: string,
  startDate: string,
  daysOfWeek: number[],
  holidaySet?: Set<string>
): number {
  const from = today > startDate ? today : startDate;
  if (from > endDate) return 0;
  return listScheduledSessionDates(from, endDate, daysOfWeek, holidaySet).length;
}

/**
 * Tập ngày nghỉ lễ đang được áp dụng của công ty trong một khoảng.
 *
 * Cố ý KHÔNG dùng listWorkingDates() của company-work-calendar.service:
 * hàm đó lọc theo workingDays của công ty (mặc định T2–T6) nên sẽ loại
 * mất các lớp học cuối tuần — rất phổ biến ở trung tâm ngoại ngữ.
 */
export async function loadHolidaySet(
  companyCode: string | undefined,
  startDate: string,
  endDate: string
): Promise<Set<string>> {
  if (!companyCode || !DATE_PATTERN.test(startDate || "") || !DATE_PATTERN.test(endDate || "")) {
    return new Set();
  }
  const days = await CompanyWorkCalendarDayModel.find({
    companyCode,
    date: { $gte: startDate, $lte: endDate },
    isApplied: true,
    dayType: { $in: ["holiday", "substitute_holiday"] },
  })
    .select("date")
    .lean();
  return new Set(days.map((d) => d.date));
}

/**
 * companyCode của chủ sở hữu lớp. Cache theo tiến trình xử lý để enrich
 * cả một trang danh sách chỉ tốn một truy vấn cho mỗi owner.
 */
export async function resolveCompanyCodeForOwner(
  ownerId: string,
  cache?: Map<string, string | undefined>
): Promise<string | undefined> {
  if (cache?.has(ownerId)) return cache.get(ownerId);
  const owner = await User.findById(ownerId).select("companyCode").lean();
  const code = (owner as { companyCode?: string } | null)?.companyCode;
  cache?.set(ownerId, code);
  return code;
}

/** Ngày hôm nay theo múi giờ Việt Nam, dạng YYYY-MM-DD */
export function todayInVietnam(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}
