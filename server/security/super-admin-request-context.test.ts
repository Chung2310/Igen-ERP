import assert from "node:assert/strict";
import test from "node:test";
import { getSuperAdminRequestMetadata, isCanonicalDeviceId } from "./super-admin-request-context";

test("accepts only canonical UUID device identifiers", () => {
  assert.equal(isCanonicalDeviceId("550e8400-e29b-41d4-a716-446655440000"), true);
  assert.equal(isCanonicalDeviceId("550E8400-E29B-41D4-A716-446655440000"), false);
  assert.equal(isCanonicalDeviceId("machine-serial"), false);
});

test("normalizes trusted request metadata", () => {
  const values: Record<string, string> = {
    "x-device-id": "550e8400-e29b-41d4-a716-446655440000",
    "user-agent": "Browser",
  };
  const metadata = getSuperAdminRequestMetadata({
    ip: "::ffff:203.0.113.9",
    get: (name: string) => values[name.toLowerCase()],
  } as any);
  assert.deepEqual(metadata, {
    deviceId: "550e8400-e29b-41d4-a716-446655440000",
    sourceIp: "203.0.113.9",
    userAgent: "Browser",
  });
});

test("ignores malformed device ids and bounds user agents", () => {
  const metadata = getSuperAdminRequestMetadata({
    ip: "127.0.0.1",
    get: (name: string) => name.toLowerCase() === "x-device-id" ? "invalid" : "x".repeat(600),
  } as any);
  assert.equal(metadata.deviceId, undefined);
  assert.equal(metadata.userAgent?.length, 512);
});
