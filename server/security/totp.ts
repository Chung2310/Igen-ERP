import { randomBytes } from "node:crypto";
import { authenticator } from "otplib";

export const createTotpSecret = (): string => authenticator.generateSecret();

export function verifyTotp(secret: string, token: string, options: { window?: number } = {}): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  try { return authenticator.verify({ secret, token } as any); } catch { return false; }
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomPart(length: number): string {
  return Array.from(randomBytes(length), (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export function generateRecoveryCodes(count = 10): string[] {
  const codes = new Set<string>();
  while (codes.size < count) codes.add(`${randomPart(5)}-${randomPart(5)}`);
  return [...codes];
}
