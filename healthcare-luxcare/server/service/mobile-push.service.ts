import { logger } from "../config/logger";
import { sendFcmPush, FcmPushError } from "./fcm-push.service";
import { randomUUID } from "node:crypto";
import { canNotifyChatMessage, enqueueChatNotifications } from "./chat-notification.service";
import { MobilePushDevice, MobilePushJob } from "../model/mobile-push.model";
import { NotificationModel } from "../model/notification.model";
import { UserModel } from "../model/user.model";
import { SuperAdminSessionModel } from "../model/super-admin-session.model";
import { getActiveSessionId } from "../security/auth-client";

export async function isMobilePushSessionActive(device: { uid: string; companyCode: string; sessionId: string }) {
  const user = await UserModel.findById(device.uid)
    .select("companyCode role activeSessionId activeWebSessionId activeMobileSessionId disabledAt")
    .lean();
  if (!user || user.disabledAt || (user.companyCode || "SYSTEM") !== device.companyCode) return false;
  if (user.role !== "superadmin") return getActiveSessionId(user, "mobile") === device.sessionId;
  return !!(await SuperAdminSessionModel.exists({
    userId: device.uid,
    sessionId: device.sessionId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }));
}

// Durable fan-out: the flag is set only after all idempotent jobs have been persisted.
// Legacy notifications without this explicit flag are intentionally not backfilled.
export async function enqueueMobileNotifications() {
  const notices = await NotificationModel.find({ mobilePushQueued: false }).sort({ createdAt: 1 }).limit(20).lean();
  for (const notice of notices) {
    const devices = await MobilePushDevice.find({
      uid: notice.recipientUid,
      companyCode: notice.companyCode,
      registeredAt: { $lte: notice.createdAt },
    }).lean();
    for (const device of devices) {
      if (!(await isMobilePushSessionActive(device))) {
        await MobilePushDevice.deleteOne({ _id: device._id, sessionId: device.sessionId });
        continue;
      }
      const notificationId = String(notice._id);
      await MobilePushJob.updateOne(
        { notificationId, token: device.token, sessionId: device.sessionId },
        {
          $setOnInsert: {
            uid: device.uid,
            companyCode: device.companyCode,
            payload: {
              title: notice.title,
              body: notice.body,
              data: {
                notificationId,
                recipientUid: notice.recipientUid,
                companyCode: notice.companyCode,
                action: notice.action,
              },
            },
            expiresAt: new Date(Date.now() + 7 * 86400000),
          },
        },
        { upsert: true },
      );
    }
    await NotificationModel.updateOne({ _id: notice._id }, { $set: { mobilePushQueued: true } });
  }
}

async function expoRequest(path: string, body: unknown) {
  const response = await fetch(`https://exp.host/--/api/v2/push/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Expo HTTP ${response.status}`);
  const result = await response.json();
  if (result.errors?.length) throw new Error("Expo request rejected");
  return result.data;
}

export async function processMobilePushJob() {
  const now = new Date();
  const lease = randomUUID();
  const job = await MobilePushJob.findOneAndUpdate(
    { state: { $in: ["send", "receipt"] }, availableAt: { $lte: now }, expiresAt: { $gt: now } },
    { $set: { lease, availableAt: new Date(Date.now() + 60000) }, $inc: { attempts: 1 } },
    { sort: { availableAt: 1 }, returnDocument: "after" },
  ).lean();
  if (!job) return false;
  const update = (values: Record<string, unknown>) =>
    MobilePushJob.updateOne({ _id: job._id, lease }, { $set: values });
  try {
    let result: any;
    if (job.state === "send") {
      const device = await MobilePushDevice.findOne({
        token: job.token,
        uid: job.uid,
        sessionId: job.sessionId,
        companyCode: job.companyCode,
      }).lean();
      if (!device || !(await isMobilePushSessionActive(device))) {
        await update({ state: "cancelled" });
        return true;
      }
      if (
        job.payload?.data?.kind === "chat" &&
        !(await canNotifyChatMessage(job.payload.data.messageId, job.uid, job.companyCode))
      ) {
        await update({ state: "cancelled" });
        return true;
      }
      if (device.provider === "fcm") {
        const messageId = await sendFcmPush(job.token, job.payload);
        await update({ state: "accepted", receiptId: messageId, lastError: null });
        return true;
      }
      const unread = await NotificationModel.countDocuments({
        recipientUid: job.uid,
        companyCode: job.companyCode,
        read: false,
      });
      const ticket = await expoRequest("send", [
        {
          to: job.token,
          ...job.payload,
          ...(job.payload?.data?.kind === "chat" ? {} : { badge: unread }),
          sound: "default",
          channelId: "default",
          ttl: 3600,
        },
      ]);
      result = ticket?.[0];
      if (result?.status === "ok" && result.id) {
        await update({
          state: "receipt",
          receiptId: result.id,
          attempts: 0,
          availableAt: new Date(Date.now() + 15 * 60000),
        });
        return true;
      }
    } else {
      result = (await expoRequest("getReceipts", { ids: [job.receiptId] }))?.[job.receiptId!];
      if (result?.status === "ok") {
        await update({ state: "delivered" });
        return true;
      }
    }
    const code = result?.details?.error;
    if (code === "DeviceNotRegistered") {
      await MobilePushDevice.deleteOne({ token: job.token, uid: job.uid, sessionId: job.sessionId });
      await update({ state: "failed", lastError: code });
    } else if (["MessageTooBig", "InvalidCredentials", "MismatchSenderId"].includes(code)) {
      await update({ state: "failed", lastError: code });
    } else throw new Error(code || "Expo response pending or invalid");
  } catch (error) {
    if (error instanceof FcmPushError) {
      if (error.code === "UNREGISTERED") {
        await MobilePushDevice.deleteOne({ token: job.token, uid: job.uid, sessionId: job.sessionId });
      }
      if (["UNREGISTERED", "INVALID_ARGUMENT", "SENDER_ID_MISMATCH", "THIRD_PARTY_AUTH_ERROR"].includes(error.code)) {
        await update({ state: "failed", lastError: error.message });
        return true;
      }
    }
    await update({
      state: job.attempts >= 8 ? "failed" : job.state,
      lastError: error instanceof Error ? error.message : "Push failed",
      availableAt: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** job.attempts)),
    });
  }
  return true;
}

export function startMobilePushWorker() {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await enqueueMobileNotifications();
      await enqueueChatNotifications();
      for (let i = 0; i < 20 && (await processMobilePushJob()); i++) {
        /* bounded drain */
      }
    } catch (error) {
      logger.error("[MobilePush] Worker will retry", error);
    } finally {
      running = false;
    }
  }, 5000);
  timer.unref();
  return () => clearInterval(timer);
}
