import webpush from "web-push";
import { PushSubscriptionModel } from "../model/push-subscription.model";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let vapidConfigured = false;

// Cấu hình VAPID lười (lazy) — chỉ khi có đủ khóa trong .env; thiếu khóa thì tính năng tự tắt
function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@igentech.vn",
    publicKey,
    privateKey
  );
  vapidConfigured = true;
  return true;
}

export const pushService = {
  /** Trả về VAPID public key cho frontend đăng ký, hoặc null nếu chưa cấu hình */
  getPublicKey(): string | null {
    return ensureVapid() ? (process.env.VAPID_PUBLIC_KEY as string) : null;
  },

  async saveSubscription(
    uid: string,
    companyCode: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    userAgent?: string
  ) {
    await PushSubscriptionModel.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      { uid, companyCode, endpoint: subscription.endpoint, keys: subscription.keys, userAgent: userAgent || "" },
      { upsert: true, returnDocument: 'after' }
    );
  },

  async removeSubscription(uid: string, endpoint: string) {
    await PushSubscriptionModel.deleteOne({ uid, endpoint });
  },

  /** Gửi thông báo đẩy tới mọi thiết bị đã đăng ký của một user */
  async sendToUser(uid: string, payload: PushPayload): Promise<void> {
    if (!ensureVapid()) return;

    const subscriptions = await PushSubscriptionModel.find({ uid }).lean();
    if (subscriptions.length === 0) return;

    const data = JSON.stringify(payload);
    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            data
          );
        } catch (error: any) {
          // 404/410 = subscription đã hết hạn hoặc bị người dùng thu hồi — dọn khỏi DB
          if (error?.statusCode === 404 || error?.statusCode === 410) {
            await PushSubscriptionModel.deleteOne({ _id: sub._id });
          } else {
            console.error("[pushService.sendToUser] Lỗi gửi push:", error?.statusCode || error?.message || error);
          }
        }
      })
    );
  },
};
