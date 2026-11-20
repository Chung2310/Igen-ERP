export const HR_CREDENTIAL_TYPES = [
  "professional_degree",
  "practice_certificate",
  "training_certificate",
  "other",
] as const;

export type HRCredentialType = (typeof HR_CREDENTIAL_TYPES)[number];
export type HRCredentialStatus = "active" | "expiring" | "expired";

function dateKey(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export function getCredentialStatus(
  expiryDate?: Date | string | null,
  reminderDays = 30,
  now = new Date(),
): HRCredentialStatus {
  if (!expiryDate) return "active";
  const expiry = new Date(`${dateKey(expiryDate)}T00:00:00.000Z`).getTime();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const remainingDays = Math.round((expiry - today) / 86_400_000);
  if (remainingDays < 0) return "expired";
  return remainingDays <= reminderDays ? "expiring" : "active";
}

export function getCredentialDaysRemaining(expiryDate?: Date | string | null, now = new Date()): number | null {
  if (!expiryDate) return null;
  const expiry = new Date(`${dateKey(expiryDate)}T00:00:00.000Z`).getTime();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((expiry - today) / 86_400_000);
}
