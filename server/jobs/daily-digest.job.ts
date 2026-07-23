import { CompanyModel } from "../model/company.model";
import { HRLeaveApplicationModel } from "../model/hr-leave-application.model";
import { UserModel } from "../model/user.model";
import { notificationService } from "../service/notification.service";
import { dashboardService } from "../service/dashboard.service";
import { EmailService } from "../modules/student-management/services/email.service";

const formatVnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;

const REMINDER_AFTER_MS = 24 * 60 * 60 * 1000;
let lastReminderDate = "";

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Nhắc các phiếu nghỉ phép còn "pending" quá 24h — chạy tối đa 1 lần/ngày,
 * quét toàn bộ công ty. Đơn giản hoá: người nhận là mọi admin/manager của
 * công ty đó (chưa lọc theo cây tổ chức — xem ghi chú tương tự trong
 * dashboard.service.ts:getActionItems).
 */
async function sendApprovalReminders() {
  const today = localDateStr(new Date());
  if (lastReminderDate === today) return;

  const cutoff = new Date(Date.now() - REMINDER_AFTER_MS);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const pending = await HRLeaveApplicationModel.find({
    status: "pending",
    createdAt: { $lte: cutoff },
    $or: [{ reminderSentAt: { $exists: false } }, { reminderSentAt: { $lt: todayStart } }],
  }).lean();

  if (pending.length === 0) {
    lastReminderDate = today;
    return;
  }

  const byCompany = new Map<string, typeof pending>();
  for (const app of pending) {
    const list = byCompany.get(app.companyCode) || [];
    list.push(app);
    byCompany.set(app.companyCode, list);
  }

  for (const [companyCode, apps] of byCompany) {
    const approvers = await UserModel.find({ companyCode, role: { $in: ["admin", "manager"] } }).select("_id").lean();
    for (const app of apps) {
      for (const approver of approvers) {
        await notificationService.createNotification({
          title: "Đơn nghỉ phép chờ duyệt quá 24 giờ",
          body: `Đơn nghỉ phép của ${app.employeeName} đang chờ duyệt.`,
          type: "he-thong",
          companyCode,
          recipientUid: String(approver._id),
          action: { tab: "NHÂN SỰ", subTab: "lich" },
        });
      }
      await HRLeaveApplicationModel.updateOne({ _id: app._id }, { $set: { reminderSentAt: new Date() } });
    }
  }

  lastReminderDate = today;
}

function buildDigestHtml(companyName: string, summary: Awaited<ReturnType<typeof dashboardService.getSummary>>) {
  return `
    <h2>Báo cáo điều hành — ${companyName}</h2>
    <p>Tổng hợp hoạt động ngày hôm qua:</p>
    <ul>
      <li>Task đang làm: ${summary.projects.tasks.doing} · Task quá hạn: ${summary.projects.overdueTasks}</li>
      <li>Chấm công: ${summary.timekeeping.checkedInToday}/${summary.timekeeping.totalEmployees} (đi muộn: ${summary.timekeeping.lateToday})</li>
      <li>Học phí đã thu: ${formatVnd(summary.students.tuitionRevenue)} · Công nợ: ${formatVnd(summary.students.outstandingDebt)}</li>
      <li>Tin nhắn chưa đọc: ${summary.chat.unreadMessages}</li>
    </ul>
  `;
}

/** Gửi báo cáo tổng quan mỗi sáng cho các công ty đã bật cấu hình. */
async function sendDailyDigests() {
  const now = new Date();
  const hour = now.getHours();
  const today = localDateStr(now);

  const companies = await CompanyModel.find({
    "dashboardReportConfig.enabled": true,
    "dashboardReportConfig.hourLocal": hour,
  }).lean();

  for (const company of companies) {
    const config = company.dashboardReportConfig;
    if (!config || config.lastSentDate === today || !config.recipients?.length) continue;

    const yesterdayStart = new Date(now);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    yesterdayStart.setHours(0, 0, 0, 0);

    try {
      const summary = await dashboardService.getSummary(
        { id: "system", role: "admin", companyCode: company.code, enabledModules: company.enabledModules },
        { start: yesterdayStart, end: now, filter: "day" }
      );
      const html = buildDigestHtml(company.name, summary);

      for (const to of config.recipients) {
        await EmailService.sendMail({ to, subject: `Báo cáo điều hành ${company.name} — ${today}`, html });
      }

      await CompanyModel.updateOne({ _id: company._id }, { $set: { "dashboardReportConfig.lastSentDate": today } });
    } catch (err) {
      console.error(`[daily-digest] Lỗi gửi báo cáo cho công ty ${company.code}:`, err);
    }
  }
}

/** Khởi động job nền: kiểm tra mỗi phút, không cần thêm dependency cron. */
export function startDailyDigestJob() {
  setInterval(() => {
    sendApprovalReminders().catch((err) => console.error("[daily-digest] Lỗi nhắc phê duyệt:", err));
    sendDailyDigests().catch((err) => console.error("[daily-digest] Lỗi gửi báo cáo:", err));
  }, 60_000);
}
