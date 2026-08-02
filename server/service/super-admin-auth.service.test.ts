import assert from "node:assert/strict";
import test from "node:test";
import { createSuperAdminAuthService } from "./super-admin-auth.service";

const device = { deviceId: "550e8400-e29b-41d4-a716-446655440000", sourceIp: "203.0.113.9", userAgent: "Browser" };

function fixture() {
  const challenges = new Map<string, any>();
  const events: any[] = [];
  const sessions = new Map<string, any>();
  const user: any = { _id: "u1", email: "root@example.com", role: "superadmin", password: "hash", superAdminSecurity: { totpEnabled: false, recoveryCodeHashes: [], failedTotpAttempts: 0 }, save: async () => user };
  const deps: any = {
    now: () => new Date("2026-07-17T00:00:00.000Z"), id: (() => { let n = 0; return () => `id-${++n}`; })(),
    users: { findSecurityUser: async () => user },
    challenges: { create: async (v: any) => (challenges.set(v.challengeId, v), v), find: async (id: string) => challenges.get(id), save: async (v: any) => (challenges.set(v.challengeId, v), v) },
    sessions: {
      create: async (v: any) => (sessions.set(v.sessionId, v), v),
      replaceActive: async ({ userId, challenge, sessionId, now, expiresAt }: any) => {
        challenge.consumedAt = now;
        challenges.set(challenge.challengeId, challenge);
        for (const session of sessions.values()) {
          if (session.userId === userId && !session.revokedAt && new Date(session.expiresAt) > now) {
            session.revokedAt = now;
            session.revokeReason = "replaced_by_new_login";
          }
        }
        const created = { sessionId, userId, deviceId: challenge.deviceId, loginIp: challenge.sourceIp, lastIp: challenge.sourceIp, userAgent: challenge.userAgent, createdAt: now, lastSeenAt: now, expiresAt };
        sessions.set(sessionId, created);
        return created;
      },
      find: async (id: string) => sessions.get(id), list: async () => [...sessions.values()], save: async (v: any) => v,
    },
    encrypt: (v: string) => `enc:${v}`, decrypt: (v: string) => v.slice(4), hash: (v: string) => `hash:${v}`,
    createSecret: () => "SECRET", verifyTotp: (_s: string, token: string) => token === "123456",
    recoveryCodes: () => ["AAAAA-BBBBB"], qr: async (uri: string) => `qr:${uri}`,
    signTokens: (_user: any, sid: string) => ({ accessToken: `access:${sid}`, refreshToken: `refresh:${sid}` }),
    comparePassword: async (raw: string) => raw === "password", audit: async (event: any) => { events.push(event); },
  };
  return { service: createSuperAdminAuthService(deps), user, events, sessions };
}

test("password-first login creates a short-lived challenge instead of tokens", async () => {
  const { service, user } = fixture();
  const result = await service.beginSuperAdminLogin(user, device);
  assert.equal(result.kind, "super_admin_challenge");
  assert.equal(result.enrollmentRequired, true);
  assert.equal("accessToken" in result, false);
});

test("password login can create a privileged session without TOTP", async () => {
  const { service, user, sessions } = fixture();
  const result = await service.completePasswordLogin(user, device);
  assert.match(result.accessToken, /^access:/);
  assert.equal(sessions.size, 1);
});

test("enrollment confirms TOTP, returns recovery codes once, and creates a session", async () => {
  const { service, user } = fixture();
  const challenge = await service.beginSuperAdminLogin(user, device);
  const enrollment = await service.beginEnrollment(challenge.challengeId, device);
  assert.match(enrollment.qrDataUrl, /^qr:otpauth:\/\//);
  const result = await service.confirmEnrollment(challenge.challengeId, "123456", device);
  assert.deepEqual(result.recoveryCodes, ["AAAAA-BBBBB"]);
  assert.match(result.accessToken, /^access:/);
  assert.equal(user.superAdminSecurity.totpEnabled, true);
});

test("dangerous step-up rejects a reused TOTP step", async () => {
  const { service, user } = fixture();
  user.superAdminSecurity.totpEnabled = true;
  user.superAdminSecurity.totpSecretEncrypted = "enc:SECRET";
  const challenge = await service.beginSuperAdminLogin(user, device);
  const login = await service.completeTotpLogin(challenge.challengeId, "123456", device);
  await service.verifyStepUp(login.sessionId, "password", "123456", 100);
  await assert.rejects(() => service.verifyStepUp(login.sessionId, "password", "123456", 100), /reused/i);
});

test("five invalid TOTP attempts lock the account for fifteen minutes", async () => {
  const { service, user } = fixture();
  user.superAdminSecurity.totpEnabled = true;
  user.superAdminSecurity.totpSecretEncrypted = "enc:SECRET";
  const challenge = await service.beginSuperAdminLogin(user, device);
  for (let attempt = 0; attempt < 5; attempt++) await assert.rejects(() => service.completeTotpLogin(challenge.challengeId, "000000", device), /invalid/i);
  assert.equal(user.superAdminSecurity.failedTotpAttempts, 5);
  assert.equal(user.superAdminSecurity.lockedUntil.toISOString(), "2026-07-17T00:15:00.000Z");
});

test("password challenge creation writes a security audit event", async () => {
  const { service, user, events } = fixture();
  await service.beginSuperAdminLogin(user, device);
  assert.equal(events[0]?.actionType, "security.login.password.success");
  assert.equal(events[0]?.result, "success");
});

test("TOTP login replaces the active privileged session", async () => {
  const { service, user, sessions } = fixture();
  user.superAdminSecurity.totpEnabled = true;
  user.superAdminSecurity.totpSecretEncrypted = "enc:SECRET";
  sessions.set("old", { sessionId: "old", userId: user._id, expiresAt: new Date("2026-07-18T00:00:00.000Z") });
  const challenge = await service.beginSuperAdminLogin(user, device);
  const login = await service.completeTotpLogin(challenge.challengeId, "123456", device);
  assert.equal(sessions.get("old").revokeReason, "replaced_by_new_login");
  assert.equal(sessions.get(login.sessionId).revokedAt, undefined);
});

test("login does not revoke another Super Admin's session", async () => {
  const { service, user, sessions } = fixture();
  user.superAdminSecurity.totpEnabled = true;
  user.superAdminSecurity.totpSecretEncrypted = "enc:SECRET";
  sessions.set("other", { sessionId: "other", userId: "u2", expiresAt: new Date("2026-07-18T00:00:00.000Z") });
  const challenge = await service.beginSuperAdminLogin(user, device);
  await service.completeTotpLogin(challenge.challengeId, "123456", device);
  assert.equal(sessions.get("other").revokedAt, undefined);
});

test("recovery login replaces the active privileged session", async () => {
  const { service, user, sessions } = fixture();
  user.superAdminSecurity.totpEnabled = true;
  user.superAdminSecurity.recoveryCodeHashes = ["hash:AAAAA-BBBBB"];
  sessions.set("old", { sessionId: "old", userId: user._id, expiresAt: new Date("2026-07-18T00:00:00.000Z") });
  const challenge = await service.beginSuperAdminLogin(user, device);
  const login = await service.completeRecoveryLogin(challenge.challengeId, "AAAAA-BBBBB", device);
  assert.equal(sessions.get("old").revokeReason, "replaced_by_new_login");
  assert.equal(sessions.get(login.sessionId).revokedAt, undefined);
});

test("enrollment login replaces the active privileged session", async () => {
  const { service, user, sessions } = fixture();
  sessions.set("old", { sessionId: "old", userId: user._id, expiresAt: new Date("2026-07-18T00:00:00.000Z") });
  const challenge = await service.beginSuperAdminLogin(user, device);
  await service.beginEnrollment(challenge.challengeId, device);
  const login = await service.confirmEnrollment(challenge.challengeId, "123456", device);
  assert.equal(sessions.get("old").revokeReason, "replaced_by_new_login");
  assert.equal(sessions.get(login.sessionId).revokedAt, undefined);
});

test("challenge and session are bound to the originating device", async () => {
  const { service, user, sessions } = fixture();
  user.superAdminSecurity.totpEnabled = true;
  user.superAdminSecurity.totpSecretEncrypted = "enc:SECRET";
  const challenge = await service.beginSuperAdminLogin(user, device);
  await assert.rejects(() => service.completeTotpLogin(challenge.challengeId, "123456", { ...device, deviceId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8" }), /device/i);
  const login = await service.completeTotpLogin(challenge.challengeId, "123456", device);
  assert.equal(sessions.get(login.sessionId).deviceId, device.deviceId);
  assert.equal(sessions.get(login.sessionId).loginIp, device.sourceIp);
  assert.equal(sessions.get(login.sessionId).lastIp, device.sourceIp);
});
