import type { Request } from "express";

export type SuperAdminRequestMetadata = {
  deviceId?: string;
  sourceIp?: string;
  userAgent?: string;
};

const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isCanonicalDeviceId(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_UUID.test(value);
}

function bounded(value: string | undefined, maxLength: number) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

export function getSuperAdminRequestMetadata(req: Pick<Request, "ip" | "get">): SuperAdminRequestMetadata {
  const candidate = bounded(req.get("x-device-id"), 64);
  const sourceIp = bounded(req.ip?.replace(/^::ffff:/, ""), 64);
  const userAgent = bounded(req.get("user-agent"), 512);
  return {
    ...(isCanonicalDeviceId(candidate) ? { deviceId: candidate } : {}),
    ...(sourceIp ? { sourceIp } : {}),
    ...(userAgent ? { userAgent } : {}),
  };
}
