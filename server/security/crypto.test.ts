import assert from "node:assert/strict";
import test from "node:test";
import { decryptSecret, encryptSecret, hashOpaque } from "./crypto";

test("encrypts with a random IV and decrypts exactly", () => {
  process.env.SUPERADMIN_ENCRYPTION_KEY = "11".repeat(32);
  const first = encryptSecret("JBSWY3DPEHPK3PXP");
  const second = encryptSecret("JBSWY3DPEHPK3PXP");
  assert.notEqual(first, second);
  assert.equal(decryptSecret(first), "JBSWY3DPEHPK3PXP");
  assert.match(first, /^v1\.[^.]+\.[^.]+\.[^.]+$/);
});

test("hashes opaque values deterministically without exposing them", () => {
  assert.equal(hashOpaque("recovery-code"), hashOpaque("recovery-code"));
  assert.notEqual(hashOpaque("recovery-code"), "recovery-code");
});
