import { createHmac } from "node:crypto";
import { getJwtAccessSecret } from "../../../config/env";
export function getMarketingApprovalSecret() {
  return process.env.MARKETING_APPROVAL_SECRET || createHmac("sha256", getJwtAccessSecret()).update("igen-erp-marketing-approval-v1").digest("hex");
}
export function getMarketingOAuthSecret() {
  return createHmac("sha256", getJwtAccessSecret()).update("igen-erp-marketing-tiktok-oauth-v1").digest("hex");
}
export function getMarketingAppUrl() {
  const input = process.env.APP_URL?.trim();
  if (!input) throw new Error("APP_URL is required for ERP marketing callbacks.");
  const url = new URL(input);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("Invalid APP_URL for ERP marketing callbacks.");
  return input.replace(/\/$/, "");
}
