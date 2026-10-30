/* eslint-disable @typescript-eslint/no-explicit-any -- TikTok response envelopes vary by API version. */
import { createHmac, timingSafeEqual } from "node:crypto";

const API_BASE_URL = "https://open-api.tiktokglobalshop.com";
const TOKEN_BASE_URL = "https://auth.tiktok-shops.com";

export class TikTokShopApiError extends Error {
  // Keep TikTok failures as API JSON responses. Returning 502 makes Cloudflare
  // replace the useful upstream error with its generic HTML gateway page.
  statusCode = 424;
  constructor(message: string, readonly apiCode?: number | string, readonly requestId?: string) {
    super(message);
    this.name = "TikTokShopApiError";
  }
}

export function getTikTokShopConfig() {
  const appKey = String(process.env.TIKTOK_SHOP_APP_KEY || "").trim();
  const appSecret = String(process.env.TIKTOK_SHOP_APP_SECRET || "").trim();
  const serviceId = String(process.env.TIKTOK_SHOP_SERVICE_ID || "").trim();
  if (!appKey || !appSecret || !serviceId) {
    throw Object.assign(new Error("TikTok Shop chưa được cấu hình APP_KEY, APP_SECRET và SERVICE_ID trên máy chủ."), { statusCode: 503 });
  }
  return {
    appKey,
    appSecret,
    serviceId,
    apiBaseUrl: String(process.env.TIKTOK_SHOP_API_BASE_URL || API_BASE_URL).replace(/\/$/, ""),
    tokenBaseUrl: String(process.env.TIKTOK_SHOP_TOKEN_BASE_URL || TOKEN_BASE_URL).replace(/\/$/, ""),
    authorizationUrl: String(process.env.TIKTOK_SHOP_AUTHORIZATION_URL || "https://services.tiktokshop.com/open/authorize").trim(),
  };
}

export function getTikTokShopWebhookConfig() {
  const appKey = String(process.env.TIKTOK_SHOP_APP_KEY || "").trim();
  const appSecret = String(process.env.TIKTOK_SHOP_APP_SECRET || "").trim();
  if (!appKey || !appSecret) throw Object.assign(new Error("TikTok Shop webhook cần cấu hình APP_KEY và APP_SECRET trên máy chủ."), { statusCode: 503 });
  return { appKey, appSecret };
}

export function verifyTikTokShopWebhookSignature(rawBody: Buffer, authorization: string, appKey: string, appSecret: string) {
  const received = String(authorization || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(received)) return false;
  const expected = createHmac("sha256", appSecret).update(appKey).update(rawBody).digest("hex");
  return timingSafeEqual(Buffer.from(received, "ascii"), Buffer.from(expected, "ascii"));
}

export function signTikTokShopRequest(path: string, params: Record<string, string>, body: string, appSecret: string): string {
  const keys = Object.keys(params).filter((key) => key !== "sign" && key !== "access_token").sort();
  let input = path;
  for (const key of keys) input += `${key}${params[key]}`;
  input += body;
  input = `${appSecret}${input}${appSecret}`;
  return createHmac("sha256", appSecret).update(input).digest("hex");
}

async function parseResponse(response: Response) {
  const payload: any = await response.json().catch(() => null);
  const apiCode = payload?.code ?? payload?.error_code ?? payload?.error?.code;
  const requestId = payload?.request_id ?? payload?.log_id;
  const apiMessage = [payload?.message, payload?.error?.message, typeof payload?.error === "string" ? payload.error : ""]
    .find((value) => typeof value === "string" && value.trim())?.trim();
  const describeFailure = (status: number, fallback: string) => {
    const parts = [`TikTok Shop HTTP ${status}`];
    if (apiCode !== undefined && apiCode !== null && String(apiCode)) parts.push(`mã ${String(apiCode).slice(0, 80)}`);
    if (apiMessage) parts.push(apiMessage.slice(0, 400));
    else parts.push(fallback);
    if (requestId) parts.push(`request_id ${String(requestId).slice(0, 100)}`);
    return parts.join(": ");
  };
  if (!response.ok) throw new TikTokShopApiError(describeFailure(response.status, "TikTok Shop từ chối yêu cầu."), apiCode, requestId);
  if (!payload || Number(payload.code) !== 0) {
    throw new TikTokShopApiError(describeFailure(response.status, "TikTok Shop trả về phản hồi không hợp lệ."), apiCode, requestId);
  }
  return payload.data ?? {};
}

export async function exchangeTikTokShopCode(authCode: string) {
  const config = getTikTokShopConfig();
  const url = new URL("/api/v2/token/get", config.tokenBaseUrl);
  url.searchParams.set("app_key", config.appKey);
  url.searchParams.set("app_secret", config.appSecret);
  url.searchParams.set("auth_code", authCode);
  url.searchParams.set("grant_type", "authorized_code");
  return parseResponse(await fetch(url, { signal: AbortSignal.timeout(20_000) }));
}

export async function refreshTikTokShopToken(refreshToken: string) {
  const config = getTikTokShopConfig();
  const url = new URL("/api/v2/token/refresh", config.tokenBaseUrl);
  url.searchParams.set("app_key", config.appKey);
  url.searchParams.set("app_secret", config.appSecret);
  url.searchParams.set("refresh_token", refreshToken);
  url.searchParams.set("grant_type", "refresh_token");
  return parseResponse(await fetch(url, { signal: AbortSignal.timeout(20_000) }));
}

export async function callTikTokShopApi(options: {
  path: string;
  method?: "GET" | "POST" | "PUT";
  accessToken: string;
  query?: Record<string, string | number | undefined>;
  body?: Record<string, unknown>;
}) {
  const config = getTikTokShopConfig();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const params: Record<string, string> = { app_key: config.appKey, timestamp };
  for (const [key, value] of Object.entries(options.query || {})) {
    if (value !== undefined && value !== "") params[key] = String(value);
  }
  const body = options.body ? JSON.stringify(options.body) : "";
  params.sign = signTikTokShopRequest(options.path, params, body, config.appSecret);
  const url = new URL(options.path, config.apiBaseUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: { "content-type": "application/json", "x-tts-access-token": options.accessToken },
    body: body || undefined,
    signal: AbortSignal.timeout(30_000),
  });
  return parseResponse(response);
}

export async function uploadTikTokShopProductImage(options: {
  path: string;
  accessToken: string;
  query?: Record<string, string | number | undefined>;
  data: Uint8Array;
  fileName: string;
  mimeType: string;
}) {
  const config = getTikTokShopConfig();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const params: Record<string, string> = { app_key: config.appKey, timestamp };
  for (const [key, value] of Object.entries(options.query || {})) {
    if (value !== undefined && value !== "") params[key] = String(value);
  }
  // TikTok signs multipart uploads without the encoded multipart body.
  params.sign = signTikTokShopRequest(options.path, params, "", config.appSecret);
  const url = new URL(options.path, config.apiBaseUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const form = new FormData();
  form.append("data", new Blob([options.data], { type: options.mimeType }), options.fileName);
  const response = await fetch(url, {
    method: "POST",
    headers: { "x-tts-access-token": options.accessToken },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  return parseResponse(response);
}
