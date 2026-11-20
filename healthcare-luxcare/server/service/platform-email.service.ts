import { organizationInvitationsConfigured } from "../config/onboarding";
import nodemailer from "nodemailer";
import { randomUUID } from "node:crypto";
import type { ClientSession } from "mongoose";
import { PendingRegistrationModel, PlatformMailOutboxModel } from "../model/onboarding.model";
import { encryptSecret, decryptSecret } from "../security/crypto";
import { getSuperAdminEncryptionKey } from "../config/env";

export function assertPlatformEmailConfigured() {
  const { PLATFORM_SMTP_HOST, PLATFORM_SMTP_USER, PLATFORM_SMTP_PASSWORD, PLATFORM_SMTP_FROM, PLATFORM_PUBLIC_URL } =
    process.env;
  if (
    ![PLATFORM_SMTP_HOST, PLATFORM_SMTP_USER, PLATFORM_SMTP_PASSWORD, PLATFORM_SMTP_FROM, PLATFORM_PUBLIC_URL].every(
      (v) => v?.trim(),
    )
  )
    throw Object.assign(new Error("Chưa cấu hình email xác minh của nền tảng."), { statusCode: 503 });
  const url = new URL(PLATFORM_PUBLIC_URL!);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    (process.env.NODE_ENV === "production" && url.protocol !== "https:")
  )
    throw new Error("PLATFORM_PUBLIC_URL phải dùng HTTPS trong production.");
  const port = Number(process.env.PLATFORM_SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PLATFORM_SMTP_PORT không hợp lệ.");
  getSuperAdminEncryptionKey();
}
export async function queuePlatformMail(
  eventKey: string,
  email: string,
  subject: string,
  text: string,
  options: { session?: ClientSession; userId?: string; expiresAt?: Date; html?: string } = {},
) {
  assertPlatformEmailConfigured();
  await PlatformMailOutboxModel.updateOne(
    { eventKey },
    {
      $setOnInsert: {
        eventKey,
        userId: options.userId,
        encryptedMessage: encryptSecret(
          JSON.stringify({
            to: email,
            subject,
            text,
            ...(options.html ? { html: options.html } : {}),
          }),
        ),
        status: "pending",
        attempts: 0,
        nextAttemptAt: new Date(),
        expiresAt: options.expiresAt,
      },
    },
    { upsert: true, session: options.session },
  );
}
let timer: ReturnType<typeof setInterval> | undefined;
export function startPlatformMailWorker() {
  if (timer || !organizationInvitationsConfigured()) return;
  assertPlatformEmailConfigured();
  const transport = nodemailer.createTransport({
    host: process.env.PLATFORM_SMTP_HOST,
    port: Number(process.env.PLATFORM_SMTP_PORT || 587),
    secure: process.env.PLATFORM_SMTP_SECURE === "true",
    auth: { user: process.env.PLATFORM_SMTP_USER, pass: process.env.PLATFORM_SMTP_PASSWORD },
    requireTLS: process.env.NODE_ENV === "production" && process.env.PLATFORM_SMTP_SECURE !== "true",
    connectionTimeout: 15000,
    socketTimeout: 20000,
    greetingTimeout: 10000,
  });
  let busy = false;
  async function tick() {
    if (busy) return;
    busy = true;
    const owner = randomUUID();
    try {
      const now = new Date();
      const row = await PlatformMailOutboxModel.findOneAndUpdate(
        {
          $or: [
            { status: "pending", nextAttemptAt: { $lte: now } },
            { status: "processing", leaseUntil: { $lte: now } },
          ],
        },
        {
          $set: { status: "processing", leaseOwner: owner, leaseUntil: new Date(Date.now() + 90000) },
          $inc: { attempts: 1 },
        },
        { returnDocument: "after", sort: { createdAt: 1 } },
      ).select("+encryptedMessage");
      if (!row) return;
      const filter = { _id: row._id, leaseOwner: owner };
      try {
        if (row.expiresAt && row.expiresAt <= now) {
          await PlatformMailOutboxModel.updateOne(filter, {
            $set: { status: "failed" },
            $unset: { encryptedMessage: 1, leaseOwner: 1, leaseUntil: 1 },
          });
          return;
        }
        const message = JSON.parse(decryptSecret(row.encryptedMessage));
        if (row.eventKey.startsWith("register-verify:")) {
          const version = row.eventKey.slice("register-verify:".length);
          const email = typeof message.to === "string" ? message.to.toLowerCase() : "";
          const isCurrent = email && (await PendingRegistrationModel.exists({ email, version }));
          if (!isCurrent) {
            await PlatformMailOutboxModel.updateOne(filter, {
              $set: { status: "superseded" },
              $unset: { encryptedMessage: 1, leaseOwner: 1, leaseUntil: 1 },
            });
            return;
          }
        }
        await transport.sendMail({
          ...message,
          from: process.env.PLATFORM_SMTP_FROM,
        });
        await PlatformMailOutboxModel.updateOne(filter, {
          $set: { status: "sent", sentAt: new Date() },
          $unset: { encryptedMessage: 1, leaseOwner: 1, leaseUntil: 1 },
        });
      } catch {
        // SMTP errors can contain credentials or recipient details. Never log their payload.
        await PlatformMailOutboxModel.updateOne(filter, {
          $set: {
            status: row.attempts >= 6 ? "failed" : "pending",
            nextAttemptAt: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** row.attempts)),
          },
          $unset: { leaseOwner: 1, leaseUntil: 1 },
        });
        console.warn("[Platform mail] Delivery failed; recorded for retry.");
      }
    } catch {
      console.warn("[Platform mail] Outbox unavailable; will retry.");
    } finally {
      busy = false;
    }
  }
  timer = setInterval(() => void tick(), 5000);
  timer.unref();
  void tick();
}
