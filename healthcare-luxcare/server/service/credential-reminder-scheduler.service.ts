import { logger } from "../config/logger";
import { getCredentialDaysRemaining } from "../../shared/hr-credential";
import { getEffectivePermissions } from "../middleware/auth";
import { HRCredentialModel } from "../model/hr-credential.model";
import { NotificationModel } from "../model/notification.model";
import { UserModel } from "../model/user.model";
import { notificationService } from "./notification.service";
import { syncCredentialStatuses } from "./hr-credential.service";

function expiryKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function runCredentialReminderScan(now = new Date()) {
  await syncCredentialStatuses({}, now);
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const latest = new Date(today.getTime() + 365 * 86_400_000);
  const credentials: any[] = await HRCredentialModel.find({
    expiryDate: { $gte: today, $lte: latest },
  }).lean();
  let created = 0;

  for (const credential of credentials) {
    const remaining = getCredentialDaysRemaining(credential.expiryDate, now);
    if (remaining === null || remaining < 0 || remaining > (credential.reminderDays || 30)) continue;
    const users: any[] = await UserModel.find({
      companyCode: credential.companyCode,
      isActive: { $ne: false },
      disabledAt: { $in: [null, undefined] },
    })
      .select("_id role branchId permissions displayName")
      .lean();
    const recipients = new Set<string>([credential.employeeId]);
    for (const user of users) {
      const permissions = await getEffectivePermissions(String(user._id), user.role, credential.companyCode);
      const managesCredentials =
        ["admin", "superadmin", "branch_owner", "manager"].includes(user.role) ||
        permissions.has("*") ||
        permissions.has("credentials:manage") ||
        permissions.has("hr:manage");
      const sameBranch =
        !credential.branchId || !user.branchId || String(user.branchId) === String(credential.branchId);
      if (managesCredentials && (user.role === "admin" || user.role === "superadmin" || sameBranch)) {
        recipients.add(String(user._id));
      }
    }
    for (const recipientUid of recipients) {
      const dedupeKey = `credential:${credential._id}:${expiryKey(credential.expiryDate)}`;
      if (await NotificationModel.exists({ companyCode: credential.companyCode, recipientUid, dedupeKey })) continue;
      try {
        await notificationService.createNotification({
          title: "Chứng chỉ sắp hết hạn",
          body: `${credential.name} của ${credential.employeeName} sẽ hết hạn sau ${remaining} ngày (${new Intl.DateTimeFormat("vi-VN").format(credential.expiryDate)}).`,
          type: "he-thong",
          companyCode: credential.companyCode,
          recipientUid,
          dedupeKey,
          read: false,
          action: { tab: "NHÂN SỰ", subTab: "VĂN BẰNG & CHỨNG CHỈ" },
        });
        created++;
      } catch (error: any) {
        if (error?.code !== 11000) throw error;
      }
    }
  }
  return { created, scanned: credentials.length };
}

export function startCredentialReminderScheduler() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await runCredentialReminderScan();
    } catch (error) {
      logger.error("[CredentialReminderScheduler]", error);
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(() => void run(), 6 * 60 * 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
