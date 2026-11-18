import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { getJwtAccessSecret } from "../config/env";
const key = () => Buffer.from(hkdfSync("sha256", getJwtAccessSecret(), "igen-assistant", "background-job-v1", 32));
export function sealAssistantJob(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}
export function openAssistantJob(value: string): any {
  const bytes = Buffer.from(value, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"));
}
