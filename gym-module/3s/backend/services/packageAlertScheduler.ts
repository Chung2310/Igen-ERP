import { logger } from '../config/logger.js';
import PtPackage from '../models/PtPackage.js';
import CustomerProfile from '../models/CustomerProfile.js';
import User from '../models/User.js';
import Center from '../models/Center.js';
import CareAlert from '../models/CareAlert.js';
import { createNotificationOnce } from './notificationService.js';
import { sendPushToUser } from './pushService.js';
import { runWithCenter, runWithSystemCenterAccess } from '../tenancy/centerContext.js';

// ─── Cấu hình ──────────────────────────────────────────────
const SCAN_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 tiếng quét 1 lần
const TARGET_HOUR_ICT = 7; // Chỉ thực sự quét nếu >= 7h sáng ICT
const ICT_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7
const LOG_CONTEXT = 'PACKAGE_ALERT_SCHEDULER';

let lastRunDate = ''; // yyyy-mm-dd format, chống chạy trùng trong cùng 1 ngày

// ─── Helpers ────────────────────────────────────────────────
function toDateKeyICT(date: Date): string {
  const d = new Date(date.getTime() + ICT_OFFSET_MS);
  return d.toISOString().slice(0, 10);
}

function dateKeyICT(): string {
  return toDateKeyICT(new Date());
}

function currentHourICT(): number {
  const now = new Date();
  const ict = new Date(now.getTime() + ICT_OFFSET_MS);
  return ict.getUTCHours();
}

function getStartOfTodayICT(): Date {
  const now = new Date();
  const ictMs = now.getTime() + ICT_OFFSET_MS;
  const ictDate = new Date(ictMs);
  const y = ictDate.getUTCFullYear();
  const m = ictDate.getUTCMonth();
  const d = ictDate.getUTCDate();
  return new Date(Date.UTC(y, m, d) - ICT_OFFSET_MS);
}

function calendarDiffDaysICT(targetDate: Date, fromDate: Date = new Date()): number {
  const targetKey = toDateKeyICT(targetDate);
  const fromKey = toDateKeyICT(fromDate);
  const [ty, tm, td] = targetKey.split('-').map(Number);
  const [fy, fm, fd] = fromKey.split('-').map(Number);
  const utcTarget = Date.UTC(ty, tm - 1, td);
  const utcFrom = Date.UTC(fy, fm - 1, fd);
  return Math.round((utcTarget - utcFrom) / 86_400_000);
}

function formatDateICT(date: Date): string {
  const d = new Date(date.getTime() + ICT_OFFSET_MS);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

// ─── Rule definitions ───────────────────────────────────────
interface AlertRule {
  ruleKey: string;
  match: (pkg: PackageInfo) => boolean;
  title: (pkg: PackageInfo) => string;
  reason: (pkg: PackageInfo) => string;
}

interface PackageInfo {
  packageId: string;
  customerName: string;
  packageName: string;
  remainingSessions: number;
  totalSessions: number;
  endDate: Date;
  daysRemaining: number;
}

const ALERT_RULES: AlertRule[] = [
  {
    ruleKey: 'PACKAGE_EXPIRING_7_DAYS',
    match: (p) => p.daysRemaining === 7,
    title: () => 'Gói tập sắp hết hạn (7 ngày)',
    reason: (p) => `Gói tập "${p.packageName}" của ${p.customerName} hết hạn ngày ${formatDateICT(p.endDate)}. Còn ${p.remainingSessions}/${p.totalSessions} buổi. Hãy trao đổi về gia hạn!`,
  },
  {
    ruleKey: 'PACKAGE_EXPIRING_3_DAYS',
    match: (p) => p.daysRemaining === 3,
    title: () => 'Gói tập sắp hết hạn (3 ngày)',
    reason: (p) => `Gói tập "${p.packageName}" của ${p.customerName} chỉ còn 3 ngày. Còn ${p.remainingSessions} buổi chưa sử dụng. Hãy liên hệ tư vấn gia hạn!`,
  },
  {
    ruleKey: 'PACKAGE_EXPIRING_1_DAY',
    match: (p) => p.daysRemaining === 1,
    title: () => 'Gói tập hết hạn ngày mai',
    reason: (p) => `Gói tập "${p.packageName}" của ${p.customerName} hết hạn ngày mai (${formatDateICT(p.endDate)}). Còn ${p.remainingSessions} buổi. Liên hệ ngay!`,
  },
  {
    ruleKey: 'PACKAGE_EXPIRED_TODAY',
    match: (p) => p.daysRemaining <= 0,
    title: () => 'Gói tập đã hết hạn',
    reason: (p) => `Gói tập "${p.packageName}" của ${p.customerName} đã hết hạn ngày ${formatDateICT(p.endDate)}. Còn ${p.remainingSessions} buổi chưa dùng. Liên hệ ngay để tái ký!`,
  },
  {
    ruleKey: 'PACKAGE_LOW_SESSIONS',
    match: (p) => p.remainingSessions > 0 && p.remainingSessions <= 3 && p.daysRemaining > 0,
    title: () => 'Học viên sắp hết buổi tập',
    reason: (p) => `${p.customerName} chỉ còn ${p.remainingSessions} buổi tập PT. Hãy trao đổi về gói tiếp theo trong buổi tập tới!`,
  },
  {
    ruleKey: 'PACKAGE_ZERO_SESSIONS',
    match: (p) => p.remainingSessions === 0 && p.daysRemaining > 0,
    title: () => 'Học viên đã hết buổi tập',
    reason: (p) => `${p.customerName} đã dùng hết ${p.totalSessions} buổi tập PT nhưng gói còn hạn đến ${formatDateICT(p.endDate)}. Liên hệ tư vấn mua thêm!`,
  },
];

// ─── Core scan ──────────────────────────────────────────────
async function scanPackagesForCenter(): Promise<void> {
  const now = new Date();
  const startOfToday = getStartOfTodayICT();
  const packages = await PtPackage.find({ status: 'ACTIVE' }).lean();

  if (packages.length === 0) {
    logger.info({ context: LOG_CONTEXT }, 'Không có gói tập ACTIVE nào để quét');
    return;
  }

  // Pre-load all customers for the packages
  const customerIds = [...new Set(packages.map((p) => String(p.customerId)))];
  const customers = await CustomerProfile.find({ _id: { $in: customerIds } }).lean();
  const customerMap = new Map(customers.map((c) => [String(c._id), c]));

  // Pre-load all admin users for sending admin notifications
  const admins = await User.find({ role: { $in: ['SUPER_ADMIN', 'ADMIN'] }, status: 'ACTIVE' }).lean();

  let alertsCreated = 0;
  let pushSent = 0;
  let packagesExpired = 0;

  for (const pkg of packages) {
    const customer = customerMap.get(String(pkg.customerId));
    if (!customer) continue;

    const info: PackageInfo = {
      packageId: String(pkg._id),
      customerName: customer.fullName,
      packageName: pkg.name,
      remainingSessions: pkg.remainingSessions,
      totalSessions: pkg.totalSessions,
      endDate: pkg.endDate,
      daysRemaining: calendarDiffDaysICT(pkg.endDate, now),
    };

    for (const rule of ALERT_RULES) {
      if (!rule.match(info)) continue;

      const title = rule.title(info);
      const reason = rule.reason(info);

      try {
        // Kiểm tra xem đã có alert nào OPEN hoặc được tạo trong ngày hôm nay cho học viên và rule này chưa
        const existingAlert = await CareAlert.findOne({
          customerId: pkg.customerId,
          ruleKey: rule.ruleKey,
          $or: [
            { status: 'OPEN' },
            { createdAt: { $gte: startOfToday } },
          ],
        }).lean();

        if (existingAlert) {
          // Đã có cảnh báo đang mở hoặc đã tạo hôm nay -> Không gửi trùng lặp
          continue;
        }

        const ptId = customer.assignedPtId || admins[0]?._id;
        if (!ptId) {
          logger.warn({ context: LOG_CONTEXT, customerId: customer._id }, 'Không có PT hay Admin nào để gán CareAlert');
          continue;
        }

        // 1. Tạo CareAlert mới
        const alert = await CareAlert.create({
          customerId: pkg.customerId,
          ptId,
          ruleKey: rule.ruleKey,
          title,
          reason,
          dueAt: pkg.endDate,
          status: 'OPEN',
        });

        alertsCreated++;

        // 2. Tạo Notification & gửi Push cho PT phụ trách
        if (customer.assignedPtId) {
          await createNotificationOnce({
            userId: customer.assignedPtId,
            type: 'PACKAGE_ALERT',
            title,
            message: reason,
            resourceType: 'careAlerts',
            resourceId: String(alert._id),
          });

          const sent = await sendPushToUser(String(customer.assignedPtId), {
            title,
            body: reason,
            data: { screen: 'care', alertId: String(alert._id) },
          });
          pushSent += sent;
        }

        // 3. Tạo Notification & gửi Push cho Admins (bỏ qua nếu admin chính là PT phụ trách để tránh gửi trùng 2 lần)
        for (const admin of admins) {
          if (customer.assignedPtId && String(customer.assignedPtId) === String(admin._id)) {
            continue;
          }

          await createNotificationOnce({
            userId: admin._id,
            type: 'PACKAGE_ALERT',
            title,
            message: reason,
            resourceType: 'careAlerts',
            resourceId: String(alert._id),
          });

          const sent = await sendPushToUser(String(admin._id), {
            title,
            body: reason,
            data: { screen: 'care', alertId: String(alert._id) },
          });
          pushSent += sent;
        }
      } catch (error) {
        // Log but don't crash - continue processing other packages
        logger.error({ context: LOG_CONTEXT, packageId: info.packageId, ruleKey: rule.ruleKey, err: error }, 'Lỗi khi xử lý cảnh báo gói tập');
      }
    }

    // 4. Tự động chuyển status EXPIRED nếu quá hạn (daysRemaining < 0)
    if (info.daysRemaining < 0) {
      try {
        await PtPackage.updateOne({ _id: pkg._id, status: 'ACTIVE' }, { $set: { status: 'EXPIRED' } });
        packagesExpired++;
      } catch (error) {
        logger.error({ context: LOG_CONTEXT, packageId: info.packageId, err: error }, 'Lỗi khi tự động chuyển trạng thái EXPIRED');
      }
    }
  }

  logger.info(
    { context: LOG_CONTEXT, scanned: packages.length, alertsCreated, pushSent, packagesExpired },
    'Quét gói tập hoàn tất',
  );
}

async function scanPackages(): Promise<void> {
  const centers = await runWithSystemCenterAccess(() => Center.find({ status: 'ACTIVE' }).select({ _id: 1 }).lean());
  for (const center of centers) await runWithCenter(String(center._id), scanPackagesForCenter);
}

// ─── Scheduler ──────────────────────────────────────────────
async function tick(): Promise<void> {
  const dateKey = dateKeyICT();
  const hour = currentHourICT();

  // Chỉ quét nếu đã qua TARGET_HOUR (7h sáng ICT) VÀ chưa quét hôm nay
  if (hour < TARGET_HOUR_ICT) return;
  if (dateKey === lastRunDate) return;

  lastRunDate = dateKey;
  logger.info({ context: LOG_CONTEXT, date: dateKey }, 'Bắt đầu quét gói tập tự động');

  try {
    await scanPackages();
  } catch (error) {
    logger.error({ context: LOG_CONTEXT, err: error }, 'Lỗi nghiêm trọng khi quét gói tập');
    // Reset lastRunDate để retry trong lần tick tiếp theo
    lastRunDate = '';
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export async function startPackageAlertScheduler(): Promise<void> {
  logger.info({ context: LOG_CONTEXT, intervalMs: SCAN_INTERVAL_MS }, 'Khởi động Package Alert Scheduler');

  // Chạy lần đầu ngầm sau khi server khởi động (không chặn server listen)
  setImmediate(() => {
    void tick();
  });

  // Lặp lại mỗi 4 tiếng
  intervalId = setInterval(() => {
    void tick();
  }, SCAN_INTERVAL_MS);
  if (intervalId && typeof intervalId.unref === 'function') {
    intervalId.unref();
  }
}

export function stopPackageAlertScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info({ context: LOG_CONTEXT }, 'Đã dừng Package Alert Scheduler');
  }
}

// Export for manual trigger from admin API if needed
export { scanPackages };
