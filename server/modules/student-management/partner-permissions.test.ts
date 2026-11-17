import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { expandEffectivePermissions, PERMISSION_CODES } from "../../config/permission-catalog";
import { DEFAULT_ROLE_PERMISSIONS } from "../../middleware/auth";

const read = (path: string) => fs.readFileSync(path, "utf8");

test("partners use standalone read and manage permissions", () => {
  const mount = read("server/modules/student-management/router.ts");
  const routes = read("server/modules/student-management/routes/partner.routes.ts");
  const catalog = read("server/config/permission-catalog.ts");
  const seed = read("server/config/database.ts");
  const uiCatalog = read("src/utils/permissionUtils.ts");
  assert.match(mount, /requirePermission\("relationship:read"\)/);
  assert.doesNotMatch(
    mount,
    /use\("\/partners"[\s\S]{0,180}requireStudentModule/,
  );
  assert.match(routes, /requirePermission\("relationship:manage"\)/);
  assert.doesNotMatch(routes, /requirePermission\("people:manage"\)/);
  assert.ok(PERMISSION_CODES.includes("relationship:read"));
  assert.ok(PERMISSION_CODES.includes("relationship:manage"));
  assert.match(catalog, /feature\("relationship"/);
  assert.match(seed, /PERMISSION_CATALOG\.map/);
  assert.match(uiCatalog, /Permission metadata is supplied by the backend registry catalog/);

  const adminPermissions = expandEffectivePermissions(DEFAULT_ROLE_PERMISSIONS.admin);
  assert.ok(adminPermissions.has("relationship:read"));
  assert.ok(adminPermissions.has("relationship:manage"));
});
