import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";

export const LOAD_TEST_BYPASS_HEADER = "x-igen-load-test-key";
const STAGING_HOSTNAME = "staging-erp.igentechsolutions.com";

export interface LoadTestBypassInput {
  nodeEnv?: string;
  hostname?: string;
  configuredSecret?: string;
  providedSecret?: string;
}

export function isStagingLoadTestBypass(input: LoadTestBypassInput): boolean {
  if (input.nodeEnv === "production") return false;
  if (input.hostname?.toLowerCase() !== STAGING_HOSTNAME) return false;
  if (!input.configuredSecret || input.configuredSecret.length < 32 || !input.providedSecret) return false;
  const expected = Buffer.from(input.configuredSecret);
  const provided = Buffer.from(input.providedSecret);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export function shouldBypassRateLimits(req: Request): boolean {
  return isStagingLoadTestBypass({
    nodeEnv: process.env.NODE_ENV,
    hostname: req.hostname,
    configuredSecret: process.env.LOAD_TEST_BYPASS_SECRET,
    providedSecret: req.get(LOAD_TEST_BYPASS_HEADER),
  });
}
