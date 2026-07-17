import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import { authenticator } from "otplib";
import { UserModel } from "../model/user.model";
import { SuperAdminChallengeModel } from "../model/super-admin-challenge.model";
import { SuperAdminSessionModel } from "../model/super-admin-session.model";
import { decryptSecret, encryptSecret, hashOpaque } from "../security/crypto";
import { createTotpSecret, generateRecoveryCodes, verifyTotp } from "../security/totp";
import { getJwtAccessSecret, getJwtRefreshSecret } from "../config/env";
import { auditService } from "./audit.service";

const CHALLENGE_MS = 5 * 60_000;
const SESSION_MS = 8 * 60 * 60_000;

export function createSuperAdminAuthService(deps: any) {
  const getChallenge = async (id: string) => {
    const challenge = await deps.challenges.find(id);
    if (!challenge || challenge.consumedAt || new Date(challenge.expiresAt) <= deps.now()) throw new Error("Challenge expired or invalid");
    return challenge;
  };
  const getUser = async (challenge: any) => {
    const user = await deps.users.findSecurityUser(challenge.userId);
    if (!user || user.role !== "superadmin") throw new Error("Super Admin account is unavailable");
    user.superAdminSecurity ||= { totpEnabled: false, recoveryCodeHashes: [], failedTotpAttempts: 0 };
    return user;
  };
  const createSession = async (user: any, challenge: any) => {
    challenge.consumedAt = deps.now(); await deps.challenges.save(challenge);
    const sessionId = deps.id();
    await deps.sessions.create({ sessionId, userId: user._id, createdAt: deps.now(), lastSeenAt: deps.now(), expiresAt: new Date(deps.now().getTime() + SESSION_MS) });
    return { sessionId, ...deps.signTokens(user, sessionId) };
  };
  return {
    async beginSuperAdminLogin(user: any) {
      const challengeId = deps.id(); const expiresAt = new Date(deps.now().getTime() + CHALLENGE_MS);
      await deps.challenges.create({ challengeId, userId: user._id, purpose: "login", passwordVerifiedAt: deps.now(), expiresAt, attempts: 0 });
      await deps.audit({ actionType: "security.login.password.success", actorSuperAdminId: user._id, result: "success" });
      return { kind: "super_admin_challenge" as const, challengeId, enrollmentRequired: !user.superAdminSecurity?.totpEnabled, expiresAt };
    },
    async beginEnrollment(challengeId: string) {
      const c = await getChallenge(challengeId); const user = await getUser(c);
      if (user.superAdminSecurity.totpEnabled) throw new Error("TOTP already enrolled");
      const secret = deps.createSecret(); c.enrollmentSecretEncrypted = deps.encrypt(secret); await deps.challenges.save(c);
      const uri = `otpauth://totp/Igen%20ERP:${encodeURIComponent(user.email)}?secret=${secret}&issuer=Igen%20ERP`;
      return { qrDataUrl: await deps.qr(uri) };
    },
    async confirmEnrollment(challengeId: string, token: string) {
      const c = await getChallenge(challengeId); const user = await getUser(c);
      if (!c.enrollmentSecretEncrypted) throw new Error("Enrollment not started");
      const secret = deps.decrypt(c.enrollmentSecretEncrypted); if (!deps.verifyTotp(secret, token)) throw new Error("Invalid TOTP code");
      const recoveryCodes = deps.recoveryCodes(); user.superAdminSecurity = { ...user.superAdminSecurity, totpEnabled: true, totpSecretEncrypted: deps.encrypt(secret), recoveryCodeHashes: recoveryCodes.map(deps.hash), enrolledAt: deps.now(), failedTotpAttempts: 0 }; await user.save();
      return { ...(await createSession(user, c)), recoveryCodes };
    },
    async completeTotpLogin(challengeId: string, token: string) {
      const c = await getChallenge(challengeId); const user = await getUser(c);
      if (user.superAdminSecurity.lockedUntil && new Date(user.superAdminSecurity.lockedUntil) > deps.now()) throw new Error("Account temporarily locked");
      const secret = deps.decrypt(user.superAdminSecurity.totpSecretEncrypted);
      if (!deps.verifyTotp(secret, token)) {
        user.superAdminSecurity.failedTotpAttempts = (user.superAdminSecurity.failedTotpAttempts || 0) + 1;
        if (user.superAdminSecurity.failedTotpAttempts >= 5) user.superAdminSecurity.lockedUntil = new Date(deps.now().getTime() + 15 * 60_000);
        await user.save(); await deps.audit({ actionType: "security.login.totp.failure", actorSuperAdminId: user._id, result: "failure" });
        throw new Error("Invalid TOTP code");
      }
      user.superAdminSecurity.failedTotpAttempts = 0; user.superAdminSecurity.lockedUntil = undefined; await user.save();
      await deps.audit({ actionType: "security.login.totp.success", actorSuperAdminId: user._id, result: "success" });
      return createSession(user, c);
    },
    async completeRecoveryLogin(challengeId: string, code: string) {
      const c = await getChallenge(challengeId); const user = await getUser(c); const hash = deps.hash(code.trim().toUpperCase());
      const index = user.superAdminSecurity.recoveryCodeHashes.indexOf(hash); if (index < 0) throw new Error("Invalid recovery code");
      user.superAdminSecurity.recoveryCodeHashes.splice(index, 1); await user.save(); return createSession(user, c);
    },
    async listSessions(userId: string) { return deps.sessions.list(userId); },
    async revokeSession(sessionId: string, reason = "manual") { const s = await deps.sessions.find(sessionId); if (!s) return false; s.revokedAt = deps.now(); s.revokeReason = reason; await deps.sessions.save(s); return true; },
    async verifyStepUp(sessionId: string, password: string, token: string, step: number) {
      const s = await deps.sessions.find(sessionId); if (!s || s.revokedAt || new Date(s.expiresAt) <= deps.now()) throw new Error("Invalid session");
      if (s.lastAcceptedTotpStep === step) throw new Error("TOTP step reused"); const user = await deps.users.findSecurityUser(s.userId);
      if (!(await deps.comparePassword(password, user.password)) || !deps.verifyTotp(deps.decrypt(user.superAdminSecurity.totpSecretEncrypted), token)) throw new Error("Step-up authentication failed");
      s.lastAcceptedTotpStep = step; await deps.sessions.save(s); return true;
    },
  };
}

const mongoDeps = {
  now: () => new Date(), id: () => randomUUID(),
  users: { findSecurityUser: (id: string) => UserModel.findById(id).select("+password +superAdminSecurity.totpSecretEncrypted +superAdminSecurity.recoveryCodeHashes") },
  challenges: { create: (v: any) => SuperAdminChallengeModel.create(v), find: (id: string) => SuperAdminChallengeModel.findOne({ challengeId: id }).select("+enrollmentSecretEncrypted"), save: (v: any) => v.save() },
  sessions: { create: (v: any) => SuperAdminSessionModel.create(v), find: (id: string) => SuperAdminSessionModel.findOne({ sessionId: id }), list: (userId: string) => SuperAdminSessionModel.find({ userId }).sort({ createdAt: -1 }).lean(), save: (v: any) => v.save() },
  encrypt: encryptSecret, decrypt: decryptSecret, hash: hashOpaque, createSecret: createTotpSecret, verifyTotp, recoveryCodes: generateRecoveryCodes,
  qr: (uri: string) => QRCode.toDataURL(uri), comparePassword: (raw: string, hash: string) => bcrypt.compare(raw, hash), audit: (event: any) => auditService.record(event),
  signTokens: (user: any, sid: string) => { const payload = { id: user._id, email: user.email, role: user.role, companyCode: user.companyCode, sid, authLevel: "totp" }; return { accessToken: jwt.sign(payload, getJwtAccessSecret(), { expiresIn: "15m" }), refreshToken: jwt.sign(payload, getJwtRefreshSecret(), { expiresIn: "8h" }) }; },
};
export const superAdminAuthService = createSuperAdminAuthService(mongoDeps);
