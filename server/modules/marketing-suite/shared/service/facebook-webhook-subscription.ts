import { createHash } from "node:crypto";

const subscriptions = new Map<string, number>();
const WEBHOOK_FIELDS = "feed,messages,message_echoes,messaging_postbacks,message_deliveries,message_reads";

type FacebookWebhookSubscription =
  | { success: true; cached?: boolean }
  | { success: false; error: string };

export class FacebookWebhookSubscriptionError extends Error {
  readonly statusCode = 502;

  constructor() {
    super("Meta chưa xác nhận đăng ký webhook. Kiểm tra cấu hình webhook và quyền nhắn tin của Fanpage rồi kết nối lại.");
    this.name = "FacebookWebhookSubscriptionError";
  }
}

export async function subscribePageWebhooks(pageId: string, token: string, force = false): Promise<FacebookWebhookSubscription> {
  const id = pageId.trim();
  if (!id || id.startsWith("mock_") || id === "unknown_page") {
    return { success: false, error: "Cần một Fanpage Facebook hợp lệ." };
  }
  const key = `${id}:${createHash("sha256").update(token).digest("hex")}`;
  if (!force && (subscriptions.get(key) || 0) > Date.now()) return { success: true, cached: true };
  const url = new URL(`https://graph.facebook.com/v25.0/${encodeURIComponent(id)}/subscribed_apps`);
  url.searchParams.set("subscribed_fields", WEBHOOK_FIELDS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    });
    const data = await response.json();
    if (response.ok && data?.success === true) {
      subscriptions.set(key, Date.now() + 60 * 60 * 1000);
      return { success: true };
    }
    console.warn("[Facebook Webhook Subscription] Meta did not confirm Page", {
      pageId: id, httpStatus: response.status, metaCode: Number(data?.error?.code) || undefined,
    });
  } catch (error) {
    console.warn("[Facebook Webhook Subscription] Request failed", { pageId: id, error: error instanceof Error ? error.name : typeof error });
  }
  subscriptions.delete(key);
  return { success: false, error: new FacebookWebhookSubscriptionError().message };
}

export async function requireFacebookWebhookSubscription(pageId: unknown, accessToken: unknown) {
  if (typeof pageId !== "string" || !pageId.trim() || typeof accessToken !== "string" || !accessToken.trim()) {
    throw Object.assign(new Error("Cần mã Fanpage và Page Access Token để đăng ký webhook Facebook."), { statusCode: 400 });
  }
  const result = await subscribePageWebhooks(pageId, accessToken.trim(), true);
  if (!result.success) throw new FacebookWebhookSubscriptionError();
}
