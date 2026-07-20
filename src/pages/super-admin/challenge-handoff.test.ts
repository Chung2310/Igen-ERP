import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("SuperAdminShell restores and clears the pending challenge", () => {
  const source = read("./SuperAdminShell.tsx");
  assert.match(source, /readPendingSuperAdminChallenge\(sessionStorage\)/);
  assert.match(source, /resolveSuperAdminChallengeStage/);
  assert.match(source, /clearPendingSuperAdminChallenge\(sessionStorage\)/);
  assert.match(source, /startEnrollment\(pendingChallenge\.challengeId\)/);
});
