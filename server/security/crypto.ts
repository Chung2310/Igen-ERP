import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getSuperAdminEncryptionKey } from "../config/env";

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getSuperAdminEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret(payload: string): string {
  const [version, ivValue, tagValue, ciphertextValue, extra] = payload.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue || extra !== undefined) throw new Error("Invalid encrypted secret payload");
  const decipher = createDecipheriv("aes-256-gcm", getSuperAdminEncryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]).toString("utf8");
}

export function hashOpaque(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
