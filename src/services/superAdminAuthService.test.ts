import { beforeEach, expect, test, vi } from "vitest";
import { superAdminAuthService } from "./superAdminAuthService";

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
test("challenge response never stores an access token", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "challenge_required", challengeId: "c1", enrollmentRequired: true }), { status: 202, headers: { "Content-Type": "application/json" } })));
  const result = await superAdminAuthService.login("root@example.com", "password");
  expect(result.status).toBe("challenge_required"); expect(localStorage.getItem("accessToken")).toBeNull();
});
test("TOTP completion stores the privileged token", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ accessToken: "token", sessionId: "s1" }), { status: 200, headers: { "Content-Type": "application/json" } })));
  await superAdminAuthService.verifyTotp("c1", "123456"); expect(localStorage.getItem("accessToken")).toBe("token");
});
