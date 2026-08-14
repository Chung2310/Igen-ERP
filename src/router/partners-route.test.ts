import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path: string) => fs.readFileSync(path, "utf8");

test("partners are a standalone app route directly after HR in the sidebar", () => {
  const types = read("src/types/common.ts");
  const routes = read("src/router/route-config.tsx");
  const sidebar = read("src/pages/Sidebar.tsx");
  const modules = read("src/config/modules.ts");

  assert.match(types, /\|\s*"ĐỐI TÁC"/);
  assert.match(routes, /tab:\s*"ĐỐI TÁC"/);
  assert.match(routes, /import\("\.\.\/pages\/PartnersTab"\)/);
  assert.ok(sidebar.indexOf('label: "ĐỐI TÁC"') > sidebar.indexOf('label: "NHÂN SỰ"'));
  assert.ok(sidebar.indexOf('label: "ĐỐI TÁC"') < sidebar.indexOf('label: "KHO & SẢN PHẨM"'));
  assert.match(modules, /"ĐỐI TÁC":\s*\["relationship:read"\]/);
});
