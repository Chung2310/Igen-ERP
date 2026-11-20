import { google } from "googleapis";

const auth = new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/firebase.messaging"] });

export class FcmPushError extends Error {
  constructor(public readonly code: string) { super(`FCM ${code}`); }
}

export function buildFcmMessage(token: string, payload: { title?: string; body?: string; data?: Record<string, unknown> }) {
  return {
    token,
    notification: { title: payload.title || "", body: payload.body || "" },
    // expo-notifications decodes body into content.data, including on a cold-start tap.
    data: { title: payload.title || "", message: payload.body || "", body: JSON.stringify(payload.data || {}), channelId: "default" },
    android: { priority: "high", ttl: "3600s", notification: { channel_id: "default", sound: "default" } },
  };
}

export async function sendFcmPush(token: string, payload: Parameters<typeof buildFcmMessage>[1]) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || await auth.getProjectId();
    if (!projectId) throw new FcmPushError("MISSING_PROJECT");
    const client = await auth.getClient();
    const response = await client.request<{ name: string }>({
      url: `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,
      method: "POST",
      data: { message: buildFcmMessage(token, payload) },
      timeout: 15000,
      retry: false,
    });
    if (!response.data.name) throw new FcmPushError("INVALID_RESPONSE");
    return response.data.name;
  } catch (error) {
    if (error instanceof FcmPushError) throw error;
    // Never persist OAuth errors/request objects: they may contain credentials or device tokens.
    const response = (error as { response?: { status?: number; data?: { error?: { details?: Array<{ "@type"?: string; errorCode?: string }> } } } })?.response;
    const code = response?.data?.error?.details?.find(item => item["@type"] === "type.googleapis.com/google.firebase.fcm.v1.FcmError")?.errorCode;
    const known = ["UNREGISTERED", "SENDER_ID_MISMATCH", "INVALID_ARGUMENT", "QUOTA_EXCEEDED", "UNAVAILABLE", "INTERNAL", "THIRD_PARTY_AUTH_ERROR"];
    throw new FcmPushError(code && known.includes(code) ? code : response?.status ? `HTTP_${response.status}` : "AUTH_OR_NETWORK");
  }
}
