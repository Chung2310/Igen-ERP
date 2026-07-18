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
  assert.match(shell, /UsersRound/);
  assert.match(shell, /Building2/);
  assert.match(tenants, /text-slate-100/);
  assert.match(tenants, /truncate/);
  assert.match(users, /text-slate-100/);
  assert.match(users, /truncate/);
});

test("audit timeline exposes operational trace filters and linked references", () => {
  const audit = read("../../components/super-admin/AuditTab.tsx");

  for (const field of ["correlationId", "entityType", "entityId", "projectId", "taskId", "workflowId"]) {
    assert.match(audit, new RegExp(`name=["']${field}["']`), field);
  }
  assert.match(audit, /selectedEvent\.correlationId/);
  assert.match(audit, /selectedEvent\.projectId/);
  assert.match(audit, /selectedEvent\.taskId/);
  assert.match(audit, /selectedEvent\.workflowId/);
});
