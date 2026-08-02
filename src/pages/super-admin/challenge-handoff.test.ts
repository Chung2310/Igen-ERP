import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("SuperAdminShell starts with password login and clears legacy challenges", () => {
  const source = read("./SuperAdminShell.tsx");
  assert.doesNotMatch(source, /readPendingSuperAdminChallenge\(sessionStorage\)/);
  assert.match(source, /localStorage\.getItem\("accessToken"\) \? "authenticated" : "password"/);
  assert.match(source, /clearPendingSuperAdminChallenge\(sessionStorage\)/);
  assert.match(source, /if \(r\.accessToken\)/);
});
