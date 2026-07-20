import assert from "node:assert/strict";
import test from "node:test";
import {
  clearPendingSuperAdminChallenge,
  readPendingSuperAdminChallenge,
  resolveSuperAdminChallengeStage,
  savePendingSuperAdminChallenge,
} from "./pendingSuperAdminChallenge";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

test("saves and restores a valid TOTP challenge", () => {
  const storage = new MemoryStorage();
  const value = { challengeId: "challenge-1", enrollmentRequired: false, expiresAt: "2030-01-01T00:00:00.000Z" };
  savePendingSuperAdminChallenge(storage, value);
  assert.deepEqual(readPendingSuperAdminChallenge(storage, Date.parse("2029-01-01T00:00:00.000Z")), value);
  assert.equal(resolveSuperAdminChallengeStage(value), "totp");
});

test("expired or malformed challenges are removed", () => {
  const storage = new MemoryStorage();
  storage.setItem("igen.pending-super-admin-challenge", JSON.stringify({ challengeId: "old", enrollmentRequired: false, expiresAt: "2020-01-01T00:00:00.000Z" }));
  assert.equal(readPendingSuperAdminChallenge(storage, Date.now()), null);
  assert.equal(storage.getItem("igen.pending-super-admin-challenge"), null);
  storage.setItem("igen.pending-super-admin-challenge", "not-json");
  assert.equal(readPendingSuperAdminChallenge(storage), null);
});

test("enrollment challenges resolve correctly and can be cleared", () => {
  const storage = new MemoryStorage();
  const value = { challengeId: "challenge-2", enrollmentRequired: true, expiresAt: "2030-01-01T00:00:00.000Z" };
  savePendingSuperAdminChallenge(storage, value);
  assert.equal(resolveSuperAdminChallengeStage(value), "enroll");
  clearPendingSuperAdminChallenge(storage);
  assert.equal(readPendingSuperAdminChallenge(storage), null);
});
