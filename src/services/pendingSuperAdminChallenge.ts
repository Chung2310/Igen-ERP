export const PENDING_SUPER_ADMIN_CHALLENGE_KEY = "igen.pending-super-admin-challenge";

export interface PendingSuperAdminChallenge {
  challengeId: string;
  enrollmentRequired: boolean;
  expiresAt: string;
}

export type SuperAdminChallengeStage = "password" | "enroll" | "totp";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function savePendingSuperAdminChallenge(storage: StorageLike, value: PendingSuperAdminChallenge): void {
  storage.setItem(PENDING_SUPER_ADMIN_CHALLENGE_KEY, JSON.stringify(value));
}

export function clearPendingSuperAdminChallenge(storage: StorageLike): void {
  storage.removeItem(PENDING_SUPER_ADMIN_CHALLENGE_KEY);
}

export function readPendingSuperAdminChallenge(storage: StorageLike, now = Date.now()): PendingSuperAdminChallenge | null {
  const raw = storage.getItem(PENDING_SUPER_ADMIN_CHALLENGE_KEY);
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as Partial<PendingSuperAdminChallenge>;
    const expiry = typeof value.expiresAt === "string" ? Date.parse(value.expiresAt) : NaN;
    if (
      typeof value.challengeId !== "string" ||
      !value.challengeId.trim() ||
      typeof value.enrollmentRequired !== "boolean" ||
      !Number.isFinite(expiry) ||
      expiry <= now
    ) {
      clearPendingSuperAdminChallenge(storage);
      return null;
    }
    return {
      challengeId: value.challengeId,
      enrollmentRequired: value.enrollmentRequired,
      expiresAt: value.expiresAt!,
    };
  } catch {
    clearPendingSuperAdminChallenge(storage);
    return null;
  }
}

export function resolveSuperAdminChallengeStage(value: PendingSuperAdminChallenge | null): SuperAdminChallengeStage {
  return value ? (value.enrollmentRequired ? "enroll" : "totp") : "password";
}
