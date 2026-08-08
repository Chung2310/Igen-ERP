import crypto from "crypto";
import type { CookieOptions } from "express";
import { StudentDeviceModel } from "../models/student-device.model";
import { logger } from "../config/logger";

const TOKEN_VERSION = "v1";
export const STUDENT_DEVICE_COOKIE_NAME = process.env.STUDENT_DEVICE_COOKIE_NAME || "igen_student_device";
const DEFAULT_TTL_DAYS = 180;

function configuredTtlDays(): number {
  const value = Number(process.env.STUDENT_DEVICE_TTL_DAYS || DEFAULT_TTL_DAYS);
  return Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), 365) : DEFAULT_TTL_DAYS;
}

function expiresAtFromNow(now = Date.now()): Date {
  return new Date(now + configuredTtlDays() * 24 * 60 * 60 * 1000);
}

function credentialHash(secret: string): string {
  const configuredPepper = process.env.STUDENT_DEVICE_TOKEN_PEPPER;
  if (!configuredPepper && process.env.NODE_ENV === "production") {
    throw new Error("STUDENT_DEVICE_TOKEN_PEPPER is required in production.");
  }
  const pepper = configuredPepper || "igen-student-device-development-pepper";
  return crypto.createHash("sha256").update(`${secret}:${pepper}`).digest("hex");
}

function metadataHash(value?: string): string | undefined {
  if (!value) return undefined;
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function parseStudentDeviceCredential(value?: string): { credentialId: string; secret: string } | null {
  if (!value) return null;
  const [version, credentialId, secret, ...rest] = value.split(".");
  if (version !== TOKEN_VERSION || !credentialId || !secret || rest.length > 0) return null;
  return { credentialId, secret };
}

export function studentDeviceCookieOptions(expiresAt: Date): CookieOptions {
  const secure = process.env.STUDENT_DEVICE_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/api/v1/qr-attendance",
    expires: expiresAt,
  };
}

export const studentDeviceClearCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.STUDENT_DEVICE_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/v1/qr-attendance",
};

export class StudentDeviceService {
  static async resolve(rawCredential?: string) {
    if (!rawCredential) {
      logger.info("[StudentDevice] resolve skipped: no cookie");
      return null;
    }
    const parsed = parseStudentDeviceCredential(rawCredential);
    if (!parsed) {
      logger.warn("[StudentDevice] resolve rejected: malformed cookie");
      return null;
    }

    const device = await StudentDeviceModel.findOne({
      credentialId: parsed.credentialId,
      status: "active",
      expiresAt: { $gt: new Date() },
    });
    if (!device) {
      logger.warn(`[StudentDevice] resolve rejected: credentialId=${parsed.credentialId} not found/expired/revoked`);
      return null;
    }

    const expected = Buffer.from(device.credentialHash, "hex");
    const actual = Buffer.from(credentialHash(parsed.secret), "hex");
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      logger.warn(`[StudentDevice] resolve rejected: credentialId=${parsed.credentialId} hash mismatch`);
      return null;
    }

    const nextExpiry = expiresAtFromNow();
    device.lastUsedAt = new Date();
    device.expiresAt = nextExpiry;
    await device.save();
    logger.info(`[StudentDevice] resolve success: credentialId=${device.credentialId}, ownerId=${device.ownerId}, studentId=${device.studentId}, expiresAt=${nextExpiry.toISOString()}`);
    return device;
  }

  static async issue(input: {
    ownerId: string;
    studentId: string;
    branchId?: string;
    batchId: string;
    userAgent?: string;
    fingerprint?: string;
  }): Promise<{ credential: string; expiresAt: Date }> {
    const credentialId = crypto.randomUUID();
    const secret = crypto.randomBytes(32).toString("base64url");
    const now = new Date();
    const expiresAt = expiresAtFromNow(now.getTime());

    logger.info(`[StudentDevice] issue started: credentialId=${credentialId}, ownerId=${input.ownerId}, studentId=${input.studentId}, batchId=${input.batchId}`);
    await StudentDeviceModel.create({
      credentialId,
      credentialHash: credentialHash(secret),
      ownerId: input.ownerId,
      studentId: input.studentId,
      branchId: input.branchId || "",
      registeredBatchId: input.batchId,
      registeredAt: now,
      lastUsedAt: now,
      expiresAt,
      userAgentHash: metadataHash(input.userAgent),
      fingerprintHash: metadataHash(input.fingerprint),
    });

    logger.info(`[StudentDevice] issue success: credentialId=${credentialId}, expiresAt=${expiresAt.toISOString()}`);
    return { credential: `${TOKEN_VERSION}.${credentialId}.${secret}`, expiresAt };
  }

  static async revoke(rawCredential?: string, reason = "student_requested") {
    const parsed = parseStudentDeviceCredential(rawCredential);
    if (!parsed) {
      logger.info("[StudentDevice] revoke skipped: no valid cookie");
      return false;
    }
    const device = await StudentDeviceModel.findOne({ credentialId: parsed.credentialId, status: "active" });
    if (!device) {
      logger.warn(`[StudentDevice] revoke skipped: credentialId=${parsed.credentialId} not found/active`);
      return false;
    }
    const expected = Buffer.from(device.credentialHash, "hex");
    const actual = Buffer.from(credentialHash(parsed.secret), "hex");
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      logger.warn(`[StudentDevice] revoke rejected: credentialId=${parsed.credentialId} hash mismatch`);
      return false;
    }
    device.status = "revoked";
    device.revokedAt = new Date();
    device.revokedReason = reason;
    await device.save();
    logger.info(`[StudentDevice] revoke success: credentialId=${device.credentialId}, reason=${reason}`);
    return true;
  }
}
