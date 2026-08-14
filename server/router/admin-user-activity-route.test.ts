import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("company admin activity route is role-guarded and tenant-scoped", () => {
  const source = fs.readFileSync("server/router/auth.router.ts", "utf8");
  assert.match(source, /users\/:id\/activity[\s\S]*requireRole\(\["admin"\]\)[\s\S]*companyCode:\s*req\.user\.companyCode/);
});
