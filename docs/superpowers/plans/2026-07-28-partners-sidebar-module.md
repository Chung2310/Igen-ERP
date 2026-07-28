# Partners Sidebar Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển Đối tác khỏi Quản lý Học viên/Lao động thành một tab ứng dụng độc lập trên sidebar với quyền `partner:read` và `partner:manage`.

**Architecture:** Giữ nguyên `PartnersPage`, model và endpoint; thêm một `PartnersTab` mỏng ở tầng app để cấp quyền/ngữ cảnh và thêm route/sidebar độc lập. Backend thay module gate/quyền Học viên bằng quyền Đối tác riêng; UI read-only ẩn toàn bộ mutation.

**Tech Stack:** React 19, TypeScript 5.8, Express 4, Vitest 4, Node test, Testing Library, Vite.

## Global Constraints

- Không đổi model Partner, collection, commission level, payout hay quan hệ referral.
- Không migrate dữ liệu và không đổi endpoint hoặc response shape.
- Không thiết kế lại giao diện trang Đối tác.
- Không di chuyển vật lý toàn bộ thư mục Đối tác trong lần này.
- Admin và Super Admin có toàn quyền; role khác cần quyền rõ ràng.
- Backend là lớp kiểm soát bắt buộc; không chỉ ẩn nút frontend.
- Không sửa các lỗi test suite tồn tại sẵn không liên quan.

---

## File Structure

- Modify `src/types/common.ts`: thêm `ĐỐI TÁC` vào `TabType`.
- Create `src/pages/PartnersTab.tsx`: route-level wrapper lấy auth context và truyền quyền quản lý vào trang hiện có.
- Modify `src/router/route-config.tsx`: đăng ký route Đối tác và bảo vệ direct navigation.
- Modify `src/pages/Sidebar.tsx`: thêm mục Đối tác đúng vị trí, không phụ thuộc `enabledModules`.
- Modify `src/config/modules.ts`: khai báo read permission cho tab Đối tác nhưng không map nó vào tenant module.
- Modify `src/modules/student-management/StudentManagementTab.tsx`: xóa sub-tab Đối tác cũ.
- Modify `src/modules/student-management/pages/Partners/PartnersPage.tsx`: nhận `canManagePartners` và ẩn mutation UI.
- Modify `server/config/permission-catalog.ts`, `server/config/database.ts`, `src/utils/permissionUtils.ts`: đăng ký hai quyền mới.
- Modify `server/modules/student-management/router.ts`, `server/modules/student-management/routes/partner.routes.ts`: enforce quyền mới, bỏ student module gate.
- Create focused tests cạnh từng boundary.

### Task 1: Permission Catalog and Backend Enforcement

**Files:**
- Create: `server/modules/student-management/partner-permissions.test.ts`
- Modify: `server/config/permission-catalog.ts`
- Modify: `server/config/database.ts`
- Modify: `src/utils/permissionUtils.ts`
- Modify: `server/modules/student-management/router.ts`
- Modify: `server/modules/student-management/routes/partner.routes.ts`

**Interfaces:**
- Produces permission codes `partner:read` and `partner:manage`.
- GET `/partners`, `/partners/:id`, `/partners/commission-levels` require `partner:read`.
- POST/PATCH/DELETE/bulk/payout/commission mutation routes require `partner:manage`.

- [ ] **Step 1: Write a failing backend wiring test**

Create a Node source-wiring test that reads the exact files and asserts:

```ts
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
```

- [ ] **Step 2: Run RED**

Run:

```powershell
node --import tsx --test server/modules/student-management/partner-permissions.test.ts
```

Expected: FAIL because no `partner:*` permission is registered and `/partners` still uses `requireStudentModule`.

- [ ] **Step 3: Implement permission catalogs**

Add to backend catalog:

```ts
{ code: "partner:read", label: "Xem đối tác & cộng tác viên", group: "Đối tác" },
{ code: "partner:manage", label: "Quản lý đối tác & hoa hồng", group: "Đối tác" },
```

Add matching seed records with `module: "partner"` and explicit descriptions. Add frontend translations under group `Quản lý Đối tác`:

```ts
"partner:read": {
  label: "Xem đối tác & cộng tác viên",
  group: "Quản lý Đối tác",
  description: "Xem danh sách, chi tiết, số liệu giới thiệu và hoa hồng đối tác",
},
"partner:manage": {
  label: "Quản lý đối tác & hoa hồng",
  group: "Quản lý Đối tác",
  description: "Thêm, sửa, xóa, nhập Excel, cấu hình level và ghi nhận chi trả hoa hồng",
},
```

- [ ] **Step 4: Implement backend enforcement**

In the root student-management router:

```ts
const requirePartnerRead = requirePermission("partner:read") as RequestHandler;
studentManagementRouter.use(
  "/partners",
  authMiddleware as unknown as RequestHandler,
  requirePartnerRead,
  partnerRoutes,
);
```

Remove `requireStudentModule` and `requireStudentRead` only from the `/partners` mount. In `partner.routes.ts`, replace the mutation middleware:

```ts
const requireManage = requirePermission("partner:manage") as any;
```

Keep GET handlers behind the mount-level read permission and every existing mutation behind `requireManage`.

- [ ] **Step 5: Run GREEN**

Run:

```powershell
node --import tsx --test server/modules/student-management/partner-permissions.test.ts
```

Expected: 1 test PASS.

- [ ] **Step 6: Commit Task 1**

```powershell
git add -- server/modules/student-management/partner-permissions.test.ts server/config/permission-catalog.ts server/config/database.ts src/utils/permissionUtils.ts server/modules/student-management/router.ts server/modules/student-management/routes/partner.routes.ts
git commit -m "feat(partners): add standalone access permissions"
```

### Task 2: App Route and Sidebar Entry

**Files:**
- Create: `src/pages/PartnersTab.tsx`
- Create: `src/router/partners-route.test.ts`
- Modify: `src/types/common.ts`
- Modify: `src/router/route-config.tsx`
- Modify: `src/pages/Sidebar.tsx`
- Modify: `src/config/modules.ts`

**Interfaces:**
- Adds `TabType` value `ĐỐI TÁC`.
- `PartnersTab` renders the existing `PartnersPage`; Task 3 adds the management flag after the page accepts it.
- Route access is true for Admin/Super Admin or users with `*`/`partner:read`.

- [ ] **Step 1: Write failing navigation wiring test**

Create a source-level test:

```ts
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
  assert.match(modules, /"ĐỐI TÁC":\s*\["partner:read"\]/);
});
```

- [ ] **Step 2: Run RED**

Run:

```powershell
node --import tsx --test src/router/partners-route.test.ts
```

Expected: FAIL because `ĐỐI TÁC` is not a `TabType`, route or sidebar item.

- [ ] **Step 3: Add type, route and permission mapping**

Add `"ĐỐI TÁC"` to `TabType`. Add:

```ts
{
  tab: "ĐỐI TÁC",
  component: lazy(() => import("../pages/PartnersTab")),
  canAccess: (profile) =>
    profile.role === "superadmin" ||
    profile.role === "admin" ||
    Boolean(profile.permissions?.includes("*") || profile.permissions?.includes("partner:read")),
},
```

Add `"ĐỐI TÁC": ["partner:read"]` to `MODULE_READ_PERMISSIONS`. Do not add it to `TAB_MODULE_MAP` or `MODULE_TAB_MAP`, so `filterEnabledTabs` never hides it by `enabledModules`.

- [ ] **Step 4: Add sidebar item and privileged-role unlock**

Import `Handshake` and insert the menu item immediately after Nhân sự:

```ts
{
  label: "ĐỐI TÁC",
  title: "Đối tác",
  icon: Handshake,
  group: "operations",
},
```

When calculating `locked`, treat Admin/Super Admin as allowed for this tab even if the profile permission array has not yet been seeded:

```ts
const isPartnerAdmin =
  item.label === "ĐỐI TÁC" &&
  (userProfile?.role === "admin" || userProfile?.role === "superadmin");
const locked = requiredPerms
  ? !isPartnerAdmin && !requiredPerms.some((code) => hasPermission(code))
  : false;
```

- [ ] **Step 5: Create the route wrapper**

Create `PartnersTab.tsx`:

```tsx
import React from "react";
import { useAuth } from "../context/AuthContext";
import { PartnersPage } from "../modules/student-management/pages/Partners/PartnersPage";

export default function PartnersTab() {
  const { userProfile } = useAuth();
  const selectedCenter =
    userProfile?.role === "superadmin"
      ? undefined
      : (userProfile as { centerId?: string } | undefined)?.centerId ||
        userProfile?.companyCode;

  return (
    <div className="h-full overflow-y-auto bg-white p-6">
      <PartnersPage selectedCenter={selectedCenter} />
    </div>
  );
}
```

- [ ] **Step 6: Run GREEN and existing module tests**

Run:

```powershell
node --import tsx --test src/router/partners-route.test.ts src/config/modules.test.ts
```

Expected: all tests PASS.

- [ ] **Step 7: Commit Task 2**

```powershell
git add -- src/pages/PartnersTab.tsx src/router/partners-route.test.ts src/types/common.ts src/router/route-config.tsx src/pages/Sidebar.tsx src/config/modules.ts
git commit -m "feat(partners): add standalone sidebar route"
```

### Task 3: Read-only Partner UI

**Files:**
- Create: `src/modules/student-management/pages/Partners/partnerAccess.ts`
- Create: `src/modules/student-management/pages/Partners/partnerAccess.test.ts`
- Modify: `src/pages/PartnersTab.tsx`
- Modify: `src/modules/student-management/pages/Partners/PartnersPage.tsx`

**Interfaces:**
- `PartnersPageProps` gains required `canManagePartners: boolean`.
- `getPartnerActionVisibility(canManagePartners)` returns flags for mutation controls and export.

- [ ] **Step 1: Write failing access-policy test**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { getPartnerActionVisibility } from "./partnerAccess";

test("read-only partner users can export but cannot mutate", () => {
  assert.deepEqual(getPartnerActionVisibility(false), {
    configureCommission: false,
    importPartners: false,
    createPartner: false,
    editPartner: false,
    payCommission: false,
    deletePartner: false,
    exportPartners: true,
  });
});

test("partner managers can use every action", () => {
  assert.ok(Object.values(getPartnerActionVisibility(true)).every(Boolean));
});
```

- [ ] **Step 2: Run RED**

Run:

```powershell
node --import tsx --test src/modules/student-management/pages/Partners/partnerAccess.test.ts
```

Expected: FAIL because `partnerAccess.ts` does not exist.

- [ ] **Step 3: Implement policy and apply it to UI**

Create the pure helper returning the exact object asserted above. Update `PartnersPage`:

```ts
interface PartnersPageProps {
  selectedCenter?: string;
  canManagePartners: boolean;
}

const actions = getPartnerActionVisibility(canManagePartners);
```

Conditionally render:

- commission configuration with `actions.configureCommission`;
- import with `actions.importPartners`;
- create with `actions.createPartner`;
- edit with `actions.editPartner`;
- payout with `actions.payCommission`;
- delete with `actions.deletePartner`.

Always render export when `actions.exportPartners`. Leave detail viewing available to read-only users.

Update `PartnersTab` to read `hasPermission`, calculate:

```ts
const canManagePartners =
  userProfile?.role === "superadmin" ||
  userProfile?.role === "admin" ||
  hasPermission("partner:manage");
```

and pass the now-supported `canManagePartners` prop into `PartnersPage`.

- [ ] **Step 4: Run GREEN**

Run:

```powershell
node --import tsx --test src/modules/student-management/pages/Partners/partnerAccess.test.ts
npm.cmd run typecheck
```

Expected: 2 tests PASS and typecheck exit 0.

- [ ] **Step 5: Commit Task 3**

```powershell
git add -- src/pages/PartnersTab.tsx src/modules/student-management/pages/Partners/partnerAccess.ts src/modules/student-management/pages/Partners/partnerAccess.test.ts src/modules/student-management/pages/Partners/PartnersPage.tsx
git commit -m "feat(partners): enforce read-only partner UI"
```

### Task 4: Remove the Legacy Student Sub-tab

**Files:**
- Create: `src/modules/student-management/student-partners-removal.test.ts`
- Modify: `src/modules/student-management/StudentManagementTab.tsx`

**Interfaces:**
- `StudentSubTab` no longer contains `ĐỐI TÁC`.
- No `doi-tac` route or `PartnersPage` lazy import remains in student management.

- [ ] **Step 1: Write failing removal test**

```ts
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("student management no longer owns the partners navigation", () => {
  const source = fs.readFileSync(
    "src/modules/student-management/StudentManagementTab.tsx",
    "utf8",
  );
  assert.doesNotMatch(source, /doi-tac/);
  assert.doesNotMatch(source, /PartnersPage/);
  assert.doesNotMatch(source, /"ĐỐI TÁC"/);
});
```

- [ ] **Step 2: Run RED**

Run:

```powershell
node --import tsx --test src/modules/student-management/student-partners-removal.test.ts
```

Expected: FAIL because the old sub-tab, import and switch branch are present.

- [ ] **Step 3: Remove the old navigation**

Delete from `StudentManagementTab.tsx`:

- `ĐỐI TÁC` from `StudentSubTab`;
- `Handshake` import;
- lazy `PartnersPage` import;
- the `{ slug: "doi-tac", ... }` route;
- the `case "ĐỐI TÁC"` render branch.

Do not delete the Partners feature files because the new route wrapper reuses them.

- [ ] **Step 4: Run GREEN**

Run:

```powershell
node --import tsx --test src/modules/student-management/student-partners-removal.test.ts
```

Expected: 1 test PASS.

- [ ] **Step 5: Commit Task 4**

```powershell
git add -- src/modules/student-management/student-partners-removal.test.ts src/modules/student-management/StudentManagementTab.tsx
git commit -m "refactor(partners): remove legacy student sub-tab"
```

### Task 5: Integrated Verification

**Files:**
- Verify all files from Tasks 1–4.

- [ ] **Step 1: Run focused tests**

```powershell
node --import tsx --test server/modules/student-management/partner-permissions.test.ts src/router/partners-route.test.ts src/config/modules.test.ts src/modules/student-management/pages/Partners/partnerAccess.test.ts src/modules/student-management/student-partners-removal.test.ts
```

Expected: all focused Node tests PASS.

- [ ] **Step 2: Run related Vitest tests**

```powershell
npx.cmd vitest run src/modules/student-management/hooks/entityPresetStore.test.tsx src/hooks/useSubTabRouter.test.tsx
```

Expected: 5 tests PASS.

- [ ] **Step 3: Run typecheck**

```powershell
npm.cmd run typecheck
```

Expected: exit 0 with no diagnostics.

- [ ] **Step 4: Run production build**

```powershell
npm.cmd run build
```

Expected: Vite and server bundle exit 0.

- [ ] **Step 5: Run full suite and compare known baseline**

```powershell
npx.cmd vitest run
```

Expected project baseline may still report the previously recorded Node/Vitest collection and jsdom failures. Confirm no newly added focused test fails and report the baseline separately.

- [ ] **Step 6: Inspect repository state**

```powershell
git diff --check
git status --short
git log -8 --oneline
```

Expected: no whitespace errors, no uncommitted source changes, and four implementation commits after the design/plan commits.
