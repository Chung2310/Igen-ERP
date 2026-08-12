import assert from "node:assert/strict";
import test from "node:test";
import { readRetailSmtpConfig, redactRetailSmtpConfig } from "./retail-reminder-mailer";

test("SMTP configuration is validated and password is always redacted", () => {
  const config = readRetailSmtpConfig({ RETAIL_SMTP_HOST: "smtp.example.com", RETAIL_SMTP_PORT: "587", RETAIL_SMTP_USER: "sender", RETAIL_SMTP_PASSWORD: "top-secret", RETAIL_SMTP_FROM: "store@example.com" } as any);
  assert.equal(config.secure, false);
  assert.deepEqual(redactRetailSmtpConfig(config), { host: "smtp.example.com", port: 587, secure: false, user: "sender", password: "[REDACTED]", from: "store@example.com" });
  assert.doesNotMatch(JSON.stringify(redactRetailSmtpConfig(config)), /top-secret/);
});

test("SMTP configuration rejects missing credentials", () => {
  assert.throws(() => readRetailSmtpConfig({ RETAIL_SMTP_HOST: "smtp.example.com" } as any));
});
