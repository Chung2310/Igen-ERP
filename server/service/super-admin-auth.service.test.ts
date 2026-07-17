import assert from "node:assert/strict";
import test from "node:test";
import { createSuperAdminAuthService } from "./super-admin-auth.service";

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
        const created = { sessionId, userId, createdAt: now, lastSeenAt: now, expiresAt };
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
  const result = await service.beginSuperAdminLogin(user);
  assert.equal(result.kind, "super_admin_challenge");
  assert.equal(result.enrollmentRequired, true);
  assert.equal("accessToken" in result, false);
});

test("enrollment confirms TOTP, returns recovery codes once, and creates a session", async () => {
  const { service, user } = fixture();
  const challenge = await service.beginSuperAdminLogin(user);
  const enrollment = await service.beginEnrollment(challenge.challengeId);
  assert.match(enrollment.qrDataUrl, /^qr:otpauth:\/\//);
  const result = await service.confirmEnrollment(challenge.challengeId, "123456");
  assert.deepEqual(result.recoveryCodes, ["AAAAA-BBBBB"]);
  assert.match(result.accessToken, /^access:/);
  assert.equal(user.superAdminSecurity.totpEnabled, true);
});

test("dangerous step-up rejects a reused TOTP step", async () => {
  const { service, user } = fixture();
  user.superAdminSecurity.totpEnabled = true;
  user.superAdminSecurity.totpSecretEncrypted = "enc:SECRET";
  const challenge = await service.beginSuperAdminLogin(user);
  const login = await service.completeTotpLogin(challenge.challengeId, "123456");
  await service.verifyStepUp(login.sessionId, "password", "123456", 100);
  await assert.rejects(() => service.verifyStepUp(login.sessionId, "password", "123456", 100), /reused/i);
});

test("five invalid TOTP attempts lock the account for fifteen minutes", async () => {
  const { service, user } = fixture();
  user.superAdminSecurity.totpEnabled = true;
  user.superAdminSecurity.totpSecretEncrypted = "enc:SECRET";
  const challenge = await service.beginSuperAdminLogin(user);
  for (let attempt = 0; attempt < 5; attempt++) await assert.rejects(() => service.completeTotpLogin(challenge.challengeId, "000000"), /invalid/i);
  assert.equal(user.superAdminSecurity.failedTotpAttempts, 5);
  assert.equal(user.superAdminSecurity.lockedUntil.toISOString(), "2026-07-17T00:15:00.000Z");
});

test("password challenge creation writes a security audit event", async () => {
  const { service, user, events } = fixture();
  await service.beginSuperAdminLogin(user);
  assert.equal(events[0]?.actionType, "security.login.password.success");
  assert.equal(events[0]?.result, "success");
});

test("TOTP login replaces the active privileged session", async () => {
  const { service, user, sessions } = fixture();
  user.superAdminSecurity.totpEnabled = true;
  user.superAdminSecurity.totpSecretEncrypted = "enc:SECRET";
  sessions.set("old", { sessionId: "old", userId: user._id, expiresAt: new Date("2026-07-18T00:00:00.000Z") });
  const challenge = await service.beginSuperAdminLogin(user);
  const login = await service.completeTotpLogin(challenge.challengeId, "123456");
  assert.equal(sessions.get("old").revokeReason, "replaced_by_new_login");
  assert.equal(sessions.get(login.sessionId).revokedAt, undefined);
});

test("recovery login replaces the active privileged session", async () => {
  const { service, user, sessions } = fixture();
  user.superAdminSecurity.totpEnabled = true;
  user.superAdminSecurity.recoveryCodeHashes = ["hash:AAAAA-BBBBB"];
  sessions.set("old", { sessionId: "old", userId: user._id, expiresAt: new Date("2026-07-18T00:00:00.000Z") });
  const challenge = await service.beginSuperAdminLogin(user);
  const login = await service.completeRecoveryLogin(challenge.challengeId, "AAAAA-BBBBB");
  assert.equal(sessions.get("old").revokeReason, "replaced_by_new_login");
  assert.equal(sessions.get(login.sessionId).revokedAt, undefined);
});

test("enrollment login replaces the active privileged session", async () => {
  const { service, user, sessions } = fixture();
  sessions.set("old", { sessionId: "old", userId: user._id, expiresAt: new Date("2026-07-18T00:00:00.000Z") });
  const challenge = await service.beginSuperAdminLogin(user);
  await service.beginEnrollment(challenge.challengeId);
  const login = await service.confirmEnrollment(challenge.challengeId, "123456");
  assert.equal(sessions.get("old").revokeReason, "replaced_by_new_login");
  assert.equal(sessions.get(login.sessionId).revokedAt, undefined);
});

test("startup preflight reports every duplicate Super Admin without modifying records", async () => {
  const duplicateService = createSuperAdminAuthService({
    users: {
      listSuperAdmins: async () => [
        { _id: "root-1", email: "root1@example.com" },
        { _id: "root-2", email: "root2@example.com" },
      ],
    },
  } as any);

  await assert.rejects(
    () => duplicateService.assertSingleSuperAdmin(),
    /root-1.*root1@example\.com.*root-2.*root2@example\.com/i,
  );
});
