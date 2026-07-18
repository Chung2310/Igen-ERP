import assert from "node:assert/strict";
import test from "node:test";
import { authenticator } from "otplib";
import { createTotpSecret, generateRecoveryCodes, verifyTotp } from "./totp";

test("accepts a current authenticator code and rejects malformed input", () => {
  const secret = authenticator.generateSecret();
  assert.equal(verifyTotp(secret, authenticator.generate(secret)), true);
  assert.equal(verifyTotp(secret, "123"), false);
  assert.equal(verifyTotp(secret, "abcdef"), false);
});

test("creates authenticator-compatible secrets", () => {
  const secret = createTotpSecret();
  assert.ok(secret.length >= 16);
  assert.equal(verifyTotp(secret, authenticator.generate(secret)), true);
});

test("recovery codes are unique and display-safe", () => {
  const codes = generateRecoveryCodes(10);
  assert.equal(new Set(codes).size, 10);
  assert.ok(codes.every((code) => /^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(code)));
});
