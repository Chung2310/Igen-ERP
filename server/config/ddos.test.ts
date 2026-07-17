import assert from "node:assert/strict";
import test from "node:test";
import { getDdosConfig } from "./ddos";

test("uses approved DDoS protection defaults", () => {
  const config = getDdosConfig({});
  assert.equal(config.globalWindowMs, 15 * 60 * 1000);
  assert.equal(config.globalLimit, 1000);
  assert.equal(config.publicLimit, 150);
  assert.equal(config.expensiveLimit, 60);
  assert.equal(config.generalBodyLimit, "2mb");
  assert.equal(config.largeBodyLimit, "300mb");
  assert.equal(config.authIpLimit, 300);
  assert.equal(config.refreshIpLimit, 1000);
  assert.equal(config.socketHandshakeLimit, 300);
  assert.equal(config.socketMaxPerUser, 5);
  assert.equal(config.socketMaxPerIp, 500);
  assert.equal(config.socketEventLimit, 120);
  assert.equal(config.authIpWindowMs, 15 * 60 * 1000);
  assert.equal(config.loginAccountWindowMs, 15 * 60 * 1000);
  assert.equal(config.loginAccountLimit, 10);
});

test("accepts positive integer overrides", () => {
  const config = getDdosConfig({
    DDOS_GLOBAL_LIMIT: "2500",
    DDOS_PUBLIC_LIMIT: "240",
    DDOS_SOCKET_MAX_PER_USER: "15",
    DDOS_GENERAL_BODY_LIMIT: "3mb",
    DDOS_AUTH_IP_LIMIT: "250",
    DDOS_LOGIN_ACCOUNT_LIMIT: "5",
  });
  assert.equal(config.globalLimit, 2500);
  assert.equal(config.publicLimit, 240);
  assert.equal(config.socketMaxPerUser, 15);
  assert.equal(config.generalBodyLimit, "3mb");
  assert.equal(config.authIpLimit, 250);
  assert.equal(config.loginAccountLimit, 5);
});

test("falls back for invalid, zero, and negative numeric values", () => {
  const config = getDdosConfig({
    DDOS_GLOBAL_LIMIT: "invalid",
    DDOS_PUBLIC_LIMIT: "0",
    DDOS_EXPENSIVE_LIMIT: "-5",
  });
  assert.equal(config.globalLimit, 1000);
  assert.equal(config.publicLimit, 150);
  assert.equal(config.expensiveLimit, 60);
});
