import { createHash, timingSafeEqual } from "node:crypto";

// Zalo OA: X-ZEvent-Signature = mac=sha256(appId + raw JSON + timestamp + OA secret).
export function verifyZaloWebhook(input: { signature?: string; rawBody?: string; appId?: string; timestamp?: string | number; expectedAppId?: string; secret?: string; now?: number }) {
  if (!input.secret || !input.expectedAppId || input.appId !== input.expectedAppId || !input.rawBody) return false;
  const signature = /^mac=([a-f0-9]{64})$/i.exec(input.signature || "")?.[1];
  const timestamp = Number(input.timestamp);
  const instant = timestamp > 100_000_000_000 ? timestamp : timestamp * 1000;
  if (!signature || !Number.isFinite(instant) || Math.abs((input.now ?? Date.now()) - instant) > 24 * 60 * 60 * 1000) return false;
  const expected = createHash("sha256").update(`${input.appId}${input.rawBody}${input.timestamp}${input.secret}`).digest();
  const actual = Buffer.from(signature, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
