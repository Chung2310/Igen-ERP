import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("super admin management screens protect narrow layouts and keep text readable", () => {
  const shell = read("./SuperAdminShell.tsx");
  const tenants = read("./tenants/TenantListPage.tsx");
  const users = read("./users/UserSearchPage.tsx");

  assert.match(shell, /min-w-0/);
  assert.match(shell, /lg:flex-row/);
  assert.match(tenants, /text-slate-100/);
  assert.match(tenants, /truncate/);
  assert.match(users, /text-slate-100/);
  assert.match(users, /truncate/);
});
