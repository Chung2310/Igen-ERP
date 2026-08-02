import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../context/AuthContext.tsx", import.meta.url), "utf8");

test("ERP password login returns the authenticated role without a TOTP challenge", () => {
  assert.doesNotMatch(source, /export interface ErpLoginChallenge/);
  assert.match(source, /export type ErpLoginOutcome/);
  assert.match(source, /Promise<ErpLoginOutcome>/);
  assert.doesNotMatch(source, /return\s+\{\s*status:\s*["']challenge_required["']/);
  assert.doesNotMatch(source, /savePendingSuperAdminChallenge/);
  assert.doesNotMatch(source, /window\.location\.pathname\s*=\s*["']\/super-admin["']/);
  assert.match(source, /return\s+\{\s*status:\s*["']authenticated["'],\s*role:/);
});

test("completing an ERP challenge hydrates the profile or clears the invalid token", () => {
  assert.match(source, /completeErpChallenge:\s*\(\)\s*=>\s*Promise<void>/);
  assert.match(source, /const completeErpChallenge\s*=\s*async\s*\(\)(?::\s*Promise<void>)?\s*=>/);
  assert.match(source, /const profile = await authService\.getMe\(\)/);
  assert.match(source, /localStorage\.removeItem\(["']accessToken["']\)/);
  assert.match(source, /throw new Error\(["']Không thể khởi tạo phiên ERP sau khi xác thực\.["']\)/);
  assert.match(source, /setUser\(profile as any\)/);
  assert.match(source, /setUserProfile\(profile\)/);
});

test("normal ERP login redirects authenticated superadmin accounts to the dedicated page", () => {
  const authPageSource = readFileSync(new URL("./AuthPage.tsx", import.meta.url), "utf8");
  assert.match(authPageSource, /const\s+\{\s*loginWithEmail\s*\}\s*=\s*useAuth\(\)/);
  assert.match(authPageSource, /const result = await loginWithEmail\(/);
  assert.doesNotMatch(authPageSource, /savePendingSuperAdminChallenge/);
  assert.match(authPageSource, /if\s*\(result\.role\s*===\s*["']superadmin["']\)\s*\{\s*window\.location\.href\s*=\s*["']\/super-admin["']/);
});
