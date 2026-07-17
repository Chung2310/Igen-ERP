import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";

import {
  extractAccessToken,
  identityKeyFromToken,
  normalizeLoginAccount,
  resolveLoginAccountKey,
} from "./rate-limit-key.js";

function req(partial: Partial<Request>): Request {
  return partial as Request;
}

test("extractAccessToken reads Bearer header then query token", () => {
  assert.equal(extractAccessToken(req({ headers: { authorization: "Bearer abc.def" }, query: {} })), "abc.def");
  assert.equal(extractAccessToken(req({ headers: {}, query: { token: "qtok" } })), "qtok");
  assert.equal(extractAccessToken(req({ headers: {}, query: {} })), undefined);
  assert.equal(extractAccessToken(req({ headers: { authorization: "Basic xyz" }, query: {} })), undefined);
});

test("identityKeyFromToken returns u:{id} only for a verified token with a string id", () => {
  assert.equal(identityKeyFromToken("t", () => ({ id: "user-123" })), "u:user-123");
  // No token -> null
  assert.equal(identityKeyFromToken(undefined, () => ({ id: "x" })), null);
  // Verify throws (bad signature/expired) -> null, never leaks
  assert.equal(identityKeyFromToken("t", () => { throw new Error("bad sig"); }), null);
  // Verify returns null / missing id / non-string id -> null
  assert.equal(identityKeyFromToken("t", () => null), null);
  assert.equal(identityKeyFromToken("t", () => ({})), null);
  assert.equal(identityKeyFromToken("t", () => ({ id: 42 as unknown as string })), null);
  assert.equal(identityKeyFromToken("t", () => ({ id: "" })), null);
});

test("normalizeLoginAccount lowercases and trims, rejects empty/non-string", () => {
  assert.equal(normalizeLoginAccount("  User@Example.COM "), "user@example.com");
  assert.equal(normalizeLoginAccount("A@b.com"), normalizeLoginAccount("a@B.COM"));
  assert.equal(normalizeLoginAccount(""), null);
  assert.equal(normalizeLoginAccount("   "), null);
  assert.equal(normalizeLoginAccount(undefined), null);
  assert.equal(normalizeLoginAccount(123), null);
});

test("resolveLoginAccountKey derives acct key from body email, null when absent", () => {
  assert.equal(resolveLoginAccountKey(req({ body: { email: "Foo@Bar.com" } })), "acct:foo@bar.com");
  assert.equal(resolveLoginAccountKey(req({ body: {} })), null);
  assert.equal(resolveLoginAccountKey(req({})), null);
});
