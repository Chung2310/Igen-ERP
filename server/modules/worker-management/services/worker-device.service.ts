import crypto from "crypto";
import type { CookieOptions } from "express";
import { WorkerDeviceModel } from "../models/worker-device.model";
import { logger } from "../../../config/logger";

const TOKEN_VERSION = "v1";
export const WORKER_DEVICE_COOKIE_NAME = process.env.WORKER_DEVICE_COOKIE_NAME || "igen_worker_device";
const DEFAULT_TTL_DAYS = 180;

function configuredTtlDays(): number {
  const value = Number(process.env.WORKER_DEVICE_TTL_DAYS || DEFAULT_TTL_DAYS);
  return Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), 365) : DEFAULT_TTL_DAYS;
}

function expiresAtFromNow(now = Date.now()): Date {
  return new Date(now + configuredTtlDays() * 24 * 60 * 60 * 1000);
}

function credentialHash(secret: string): string {
  const configuredPepper = process.env.WORKER_DEVICE_TOKEN_PEPPER;
  if (!configuredPepper && process.env.NODE_ENV === "production") {
    throw new Error("WORKER_DEVICE_TOKEN_PEPPER is required in production.");
  }
  const pepper = configuredPepper || "igen-worker-device-development-pepper";
  return crypto.createHash("sha256").update(`${secret}:${pepper}`).digest("hex");
}

function metadataHash(value?: string): string | undefined {
  if (!value) return undefined;
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function parseWorkerDeviceCredential(value?: string): { credentialId: string; secret: string } | null {
  if (!value) return null;
  const [version, credentialId, secret, ...rest] = value.split(".");
  if (version !== TOKEN_VERSION || !credentialId || !secret || rest.length > 0) return null;
  return { credentialId, secret };
}

export function workerDeviceCookieOptions(expiresAt: Date): CookieOptions {
  const secure = process.env.WORKER_DEVICE_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/api/v1/worker-management/qr-attendance",
    expires: expiresAt,
  };
}

export const workerDeviceClearCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.WORKER_DEVICE_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/v1/worker-management/qr-attendance",
};

export class WorkerDeviceService {
  static async resolve(rawCredential?: string) {
    if (!rawCredential) {
      logger.info("[WorkerDevice] resolve skipped: no cookie");
      return null;
    }
    const parsed = parseWorkerDeviceCredential(rawCredential);
    if (!parsed) {
      logger.warn("[WorkerDevice] resolve rejected: malformed cookie");
      return null;
    }

    const device = await WorkerDeviceModel.findOne({
      credentialId: parsed.credentialId,
      status: "active",
      expiresAt: { $gt: new Date() },
    });
    if (!device) {
      logger.warn(`[WorkerDevice] resolve rejected: credentialId=${parsed.credentialId} not found/expired/revoked`);
      return null;
    }

    const expected = Buffer.from(device.credentialHash, "hex");
    const actual = Buffer.from(credentialHash(parsed.secret), "hex");
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      logger.warn(`[WorkerDevice] resolve rejected: credentialId=${parsed.credentialId} hash mismatch`);
      return null;
    }

    const nextExpiry = expiresAtFromNow();
    device.lastUsedAt = new Date();
    device.expiresAt = nextExpiry;
    await device.save();
    logger.info(`[WorkerDevice] resolve success: credentialId=${device.credentialId}, companyCode=${device.companyCode}, workerId=${device.workerId}, expiresAt=${nextExpiry.toISOString()}`);
    return device;
  }

  static async issue(input: {
    companyCode: string;
    workerId: string;
    userAgent?: string;
    fingerprint?: string;
  }): Promise<{ credential: string; expiresAt: Date }> {
    const credentialId = crypto.randomUUID();
    const secret = crypto.randomBytes(32).toString("base64url");
    const now = new Date();
    const expiresAt = expiresAtFromNow(now.getTime());

    logger.info(`[WorkerDevice] issue started: credentialId=${credentialId}, companyCode=${input.companyCode}, workerId=${input.workerId}`);
    await WorkerDeviceModel.create({
      credentialId,
      credentialHash: credentialHash(secret),
      companyCode: input.companyCode,
      workerId: input.workerId,
      registeredAt: now,
      lastUsedAt: now,
      expiresAt,
      userAgentHash: metadataHash(input.userAgent),
      fingerprintHash: metadataHash(input.fingerprint),
    });

    logger.info(`[WorkerDevice] issue success: credentialId=${credentialId}, expiresAt=${expiresAt.toISOString()}`);
    return { credential: `${TOKEN_VERSION}.${credentialId}.${secret}`, expiresAt };
  }

  static async revoke(rawCredential?: string, reason = "worker_requested") {
    const parsed = parseWorkerDeviceCredential(rawCredential);
    if (!parsed) {
      logger.info("[WorkerDevice] revoke skipped: no valid cookie");
      return false;
    }
    const device = await WorkerDeviceModel.findOne({ credentialId: parsed.credentialId, status: "active" });
    if (!device) {
      logger.warn(`[WorkerDevice] revoke skipped: credentialId=${parsed.credentialId} not found/active`);
      return false;
    }
    const expected = Buffer.from(device.credentialHash, "hex");
    const actual = Buffer.from(credentialHash(parsed.secret), "hex");
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      logger.warn(`[WorkerDevice] revoke rejected: credentialId=${parsed.credentialId} hash mismatch`);
      return false;
    }
    device.status = "revoked";
    device.revokedAt = new Date();
    device.revokedReason = reason;
    await device.save();
    logger.info(`[WorkerDevice] revoke success: credentialId=${device.credentialId}, reason=${reason}`);
    return true;
  }
}
