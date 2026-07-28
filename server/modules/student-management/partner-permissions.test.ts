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

  assert.match(mount, /requirePermission\("partner:read"\)/);
  assert.doesNotMatch(
    mount,
    /use\("\/partners"[\s\S]{0,180}requireStudentModule/,
  );
  assert.match(routes, /requirePermission\("partner:manage"\)/);
  assert.doesNotMatch(routes, /requirePermission\("student:manage"\)/);
  for (const source of [catalog, seed, uiCatalog]) {
    assert.match(source, /partner:read/);
    assert.match(source, /partner:manage/);
  }
});
