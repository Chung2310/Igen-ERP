import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./rate-limit.ts", import.meta.url), "utf8");

test("auth account and refresh limiters use distinct Redis stores", () => {
  for (const prefix of ["http:auth-ip", "http:login-account", "http:refresh-ip"]) {
    assert.match(source, new RegExp(`RedisRateLimitStore\\(redisClient, .*${prefix}`), prefix);
  }
  assert.match(source, /refreshIpWindowMs/);
  assert.match(source, /refreshIpLimit/);
});
