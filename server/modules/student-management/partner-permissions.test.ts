import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path: string) => fs.readFileSync(path, "utf8");

test("partners use standalone read and manage permissions", () => {
  const mount = read("server/modules/student-management/router.ts");
  const routes = read("server/modules/student-management/routes/partner.routes.ts");
  const catalog = read("server/config/permission-catalog.ts");
  const seed = read("server/config/database.ts");
  const uiCatalog = read("src/utils/permissionUtils.ts");
  const auth = read("server/middleware/auth.ts");

  assert.match(mount, /requirePermission\("relationship:read"\)/);
  assert.doesNotMatch(
    mount,
    /use\("\/partners"[\s\S]{0,180}requireStudentModule/,
  );
  assert.match(routes, /requirePermission\("relationship:manage"\)/);
  assert.doesNotMatch(routes, /requirePermission\("people:manage"\)/);
  for (const source of [catalog, seed, uiCatalog]) {
    assert.match(source, /relationship:read/);
    assert.match(source, /relationship:manage/);
  }

  const adminPermissions = auth.match(/admin:\s*\[([\s\S]*?)\r?\n\s*\],\r?\n\s*branch_owner:/)?.[1] || "";
  assert.match(adminPermissions, /"relationship:read"/);
  assert.match(adminPermissions, /"relationship:manage"/);
});
