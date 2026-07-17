import assert from "node:assert/strict";
import test from "node:test";
import { redactSensitive } from "./redaction";

test("redacts sensitive keys recursively without mutating safe values", () => {
  const input = { email: "a@b.vn", nested: { password: "x", accessToken: "y" } };
  assert.deepEqual(redactSensitive(input), {
    email: "a@b.vn",
    nested: { password: "[REDACTED]", accessToken: "[REDACTED]" },
  });
  assert.equal(input.nested.password, "x");
});

test("redacts sensitive keys case-insensitively in arrays", () => {
  assert.deepEqual(redactSensitive([{ PRIVATE_KEY: "x", safe: true }]), [
    { PRIVATE_KEY: "[REDACTED]", safe: true },
  ]);
});
