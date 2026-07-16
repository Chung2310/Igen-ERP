import assert from "node:assert/strict";
import test from "node:test";
import { getTrustedSocketClientIp } from "./socket-client-ip";

test("prefers a trimmed sanitized X-Real-IP header", () => {
  assert.equal(getTrustedSocketClientIp({ "x-real-ip": " 203.0.113.7 " }, "127.0.0.1"), "203.0.113.7");
});

test("accepts Node's one-item header array representation", () => {
  assert.equal(getTrustedSocketClientIp({ "x-real-ip": ["2001:db8::7"] }, "127.0.0.1"), "2001:db8::7");
});

test("rejects forwarding chains instead of choosing an attacker-controlled value", () => {
  assert.equal(
    getTrustedSocketClientIp({ "x-real-ip": "198.51.100.1, 203.0.113.7" }, "127.0.0.1"),
    "127.0.0.1",
  );
});

test("falls back for blank or ambiguous array headers", () => {
  assert.equal(getTrustedSocketClientIp({ "x-real-ip": "   " }, "127.0.0.1"), "127.0.0.1");
  assert.equal(getTrustedSocketClientIp({ "x-real-ip": ["203.0.113.7", "198.51.100.1"] }, "127.0.0.1"), "127.0.0.1");
});

test("returns unknown when no trusted or transport address exists", () => {
  assert.equal(getTrustedSocketClientIp({}, undefined), "unknown");
});
