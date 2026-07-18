# Company Module Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép chọn module nghiệp vụ khi tạo doanh nghiệp; ẩn module tắt trên sidebar/router/Tổng quan và chặn API tương ứng; superadmin sửa lại qua modal sửa doanh nghiệp.

**Architecture:** Trường `enabledModules: string[]` trên `Company` (thiếu/rỗng = bật tất cả, backward compatible). Frontend nhận `enabledModules` qua `/auth/me`, lưu trong `AuthContext`, lọc Sidebar/router/DashboardTab. Backend middleware `requireModule(key)` (cache in-memory 60s) chặn 403 các router module; generic CRUD chặn theo mapping modelName→module.

**Tech Stack:** Express + Mongoose + Joi (server), React + TS (client), test bằng `node:test` chạy qua `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-07-18-company-module-toggle-design.md`

## Global Constraints

- 5 module key: `"hr" | "inventory" | "resource" | "chat" | "student"`. TỔNG QUAN, VÍ & NẠP TIỀN, QUẢN TRỊ USER, CÀI ĐẶT không bao giờ bị ẩn.
- Company không có trường `enabledModules` hoặc mảng rỗng → coi là bật TẤT CẢ.
- Superadmin (role `superadmin`) không bị chặn bởi `requireModule`.
- Tạo DN chỉ qua modal trong `UserAdminTab.tsx` (superadmin); sau đó chỉ superadmin sửa qua modal "Sửa doanh nghiệp" cùng file.
- Copy tiếng Việt cho lỗi 403: `"Module chưa được kích hoạt cho doanh nghiệp của bạn."`
- Typecheck sau mỗi task: `yarn typecheck`. Commit thường xuyên.

---

### Task 1: Hằng module dùng chung + Company model/interface

**Files:**
- Create: `server/config/module-keys.ts`
- Create: `src/config/modules.ts`
- Modify: `server/interface/company.interface.ts` (interface `ICompany`)
- Modify: `server/model/company.model.ts` (`CompanySchema`)

**Interfaces:**
- Produces (server): `MODULE_KEYS: ModuleKey[]`, `type ModuleKey`, `isModuleKey(v: string): v is ModuleKey`, `sanitizeModuleKeys(input: unknown): ModuleKey[]` (lọc key hợp lệ, bỏ trùng; trả `[...MODULE_KEYS]` nếu kết quả rỗng/không phải mảng).
- Produces (client): `MODULE_KEYS`, `type ModuleKey`, `MODULE_TAB_MAP: Record<ModuleKey, TabType>`, `MODULE_LABELS: Record<ModuleKey, string>`, `TAB_MODULE_MAP: Partial<Record<TabType, ModuleKey>>`.

- [ ] **Step 1: Tạo `server/config/module-keys.ts`**

```ts
/** Các module nghiệp vụ có thể bật/tắt theo doanh nghiệp. Đồng bộ với src/config/modules.ts. */
export const MODULE_KEYS = ["hr", "inventory", "resource", "chat", "student"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export function isModuleKey(v: string): v is ModuleKey {
  return (MODULE_KEYS as readonly string[]).includes(v);
}

/** Lọc input từ client thành danh sách key hợp lệ, bỏ trùng. Rỗng/không hợp lệ → bật tất cả. */
export function sanitizeModuleKeys(input: unknown): ModuleKey[] {
  if (!Array.isArray(input)) return [...MODULE_KEYS];
  const cleaned = [...new Set(input.filter((v): v is ModuleKey => typeof v === "string" && isModuleKey(v)))];
  return cleaned.length > 0 ? cleaned : [...MODULE_KEYS];
}
```

- [ ] **Step 2: Tạo `src/config/modules.ts`**

```ts
import type { TabType } from "../types";

/** Đồng bộ với server/config/module-keys.ts */
export const MODULE_KEYS = ["hr", "inventory", "resource", "chat", "student"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  hr: "Nhân sự",
  inventory: "Kho & Sản phẩm",
  resource: "Quản lý tài nguyên",
  chat: "Trò chuyện",
  student: "Quản lý học viên",
};

export const MODULE_TAB_MAP: Record<ModuleKey, TabType> = {
  hr: "NHÂN SỰ",
  inventory: "KHO & SẢN PHẨM",
  resource: "QUẢN LÝ TÀI NGUYÊN",
  chat: "TRÒ CHUYỆN",
  student: "QUẢN LÝ HỌC VIÊN",
};

export const TAB_MODULE_MAP: Partial<Record<TabType, ModuleKey>> = {
  "NHÂN SỰ": "hr",
  "KHO & SẢN PHẨM": "inventory",
  "QUẢN LÝ TÀI NGUYÊN": "resource",
  "TRÒ CHUYỆN": "chat",
  "QUẢN LÝ HỌC VIÊN": "student",
};

/** Thiếu dữ liệu (company cũ) → bật tất cả. */
export function isModuleEnabled(enabledModules: string[] | undefined, key: ModuleKey): boolean {
  if (!enabledModules || enabledModules.length === 0) return true;
  return enabledModules.includes(key);
}
```

- [ ] **Step 3: Thêm trường vào interface + schema**

`server/interface/company.interface.ts` — trong `ICompany` (sau `ownerEmail`):

```ts
  /** Các module nghiệp vụ được bật cho doanh nghiệp. Rỗng/thiếu = bật tất cả. */
  enabledModules?: string[];
```

`server/model/company.model.ts` — import và thêm vào `CompanySchema` (sau `ownerEmail`, trước `lifecycleStatus`):

```ts
import { MODULE_KEYS } from "../config/module-keys";
// ...
  enabledModules: { type: [String], enum: MODULE_KEYS, default: () => [...MODULE_KEYS] },
```

- [ ] **Step 4: Typecheck**

Run: `yarn typecheck` — Expected: pass (không lỗi mới).

- [ ] **Step 5: Commit**

```bash
git add server/config/module-keys.ts src/config/modules.ts server/interface/company.interface.ts server/model/company.model.ts
git commit -m "feat: thêm enabledModules vào Company và hằng module dùng chung"
```

---

### Task 2: Nhận enabledModules khi tạo doanh nghiệp (server)

**Files:**
- Modify: `server/service/auth.service.ts` (`registerCompanyAndAdmin`, ~dòng 217)
- Modify: `server/router/auth.router.ts` (`registerCompanySchema`, ~dòng 151)
- Test: `server/service/auth-register-modules.test.ts` (mới)

**Interfaces:**
- Consumes: `sanitizeModuleKeys` từ Task 1.
- Produces: `registerCompanyAndAdmin(data)` chấp nhận thêm `data.enabledModules?: string[]`; company tạo ra có `enabledModules` đã được lọc.

- [ ] **Step 1: Viết test fail trước** — `server/service/auth-register-modules.test.ts`

Test thuần cho `sanitizeModuleKeys` (logic quyết định) — không cần DB:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeModuleKeys, MODULE_KEYS } from "../config/module-keys";

test("giữ nguyên danh sách key hợp lệ, bỏ trùng", () => {
  assert.deepEqual(sanitizeModuleKeys(["hr", "inventory", "hr"]), ["hr", "inventory"]);
});

test("loại key rác", () => {
  assert.deepEqual(sanitizeModuleKeys(["hr", "hack", 5, null]), ["hr"]);
});

test("rỗng hoặc không phải mảng → bật tất cả", () => {
  assert.deepEqual(sanitizeModuleKeys([]), [...MODULE_KEYS]);
  assert.deepEqual(sanitizeModuleKeys(undefined), [...MODULE_KEYS]);
  assert.deepEqual(sanitizeModuleKeys(["hack"]), [...MODULE_KEYS]);
});
```

- [ ] **Step 2: Chạy test**

Run: `npx tsx --test server/service/auth-register-modules.test.ts`
Expected: PASS (hàm đã viết ở Task 1 — nếu FAIL, sửa `sanitizeModuleKeys` cho khớp).

- [ ] **Step 3: Sửa `registerCompanyAndAdmin`**

Trong `server/service/auth.service.ts`, đầu file import `sanitizeModuleKeys` từ `../config/module-keys`. Trong hàm (~dòng 218):

```ts
const { companyName, companyCode, ownerName, ownerEmail, ownerPassword, enabledModules } = data;
```

và khi tạo company (~dòng 235):

```ts
const newCompany = new CompanyModel({
  code: normalizedCode,
  name: companyName.trim(),
  ownerEmail: emailLower,
  enabledModules: sanitizeModuleKeys(enabledModules),
  createdAt: new Date(),
});
```

- [ ] **Step 4: Thêm vào Joi schema**

`server/router/auth.router.ts`, trong `registerCompanySchema.body` (sau `ownerPassword`):

```ts
enabledModules: Joi.array().items(Joi.string()).optional(),
```

- [ ] **Step 5: Typecheck + commit**

Run: `yarn typecheck` → pass.

```bash
git add server/service/auth.service.ts server/router/auth.router.ts server/service/auth-register-modules.test.ts
git commit -m "feat: nhận enabledModules khi đăng ký doanh nghiệp"
```

---

### Task 3: Trả enabledModules qua /auth/me + AuthContext

**Files:**
- Modify: `server/controller/auth.controller.ts` (`getMe`, ~dòng 156-190)
- Modify: `src/types/common.ts` (`UserProfile`)
- Modify: `src/context/AuthContext.tsx`

**Interfaces:**
- Consumes: `sanitizeModuleKeys` (server), `isModuleEnabled`/`ModuleKey` (client, Task 1).
- Produces: response `/auth/me` có `user.enabledModules: string[]`; `UserProfile.enabledModules?: string[]`; `AuthContext` expose `isModuleEnabled(key: ModuleKey): boolean`.

- [ ] **Step 1: Server — getMe đính kèm enabledModules**

Trong `server/controller/auth.controller.ts`, đầu file thêm import:

```ts
import { CompanyModel } from "../model/company.model";
import { sanitizeModuleKeys } from "../config/module-keys";
```

Trong `getMe`, thay đoạn trả về (~dòng 177-181):

```ts
      const userObj: any = user.toObject();
      delete userObj.password;
      let enabledModules = sanitizeModuleKeys(undefined); // mặc định bật tất cả
      if (userObj.companyCode && userObj.companyCode !== "SYSTEM") {
        const company = await CompanyModel.findOne({ code: userObj.companyCode }).select("enabledModules").lean();
        enabledModules = sanitizeModuleKeys(company?.enabledModules?.length ? company.enabledModules : undefined);
      }
      userObj.enabledModules = enabledModules;

      return res.status(200).json({
        status: "success",
        user: userObj,
      });
```

- [ ] **Step 2: Client — UserProfile + AuthContext**

`src/types/common.ts`, trong `UserProfile` (sau `companyName`):

```ts
  /** Module nghiệp vụ được bật cho doanh nghiệp (từ /auth/me). Thiếu = bật tất cả. */
  enabledModules?: string[];
```

`src/context/AuthContext.tsx`:
- Import: `import { isModuleEnabled as checkModule, type ModuleKey } from "../config/modules";`
- Thêm vào `AuthContextType`: `isModuleEnabled: (key: ModuleKey) => boolean;`
- Trong provider, trước `return`:

```ts
const isModuleEnabled = (key: ModuleKey) => checkModule(userProfile?.enabledModules, key);
```

- Thêm `isModuleEnabled` vào object value của Provider (cạnh `userProfile`).

- [ ] **Step 3: Typecheck + commit**

Run: `yarn typecheck` → pass.

```bash
git add server/controller/auth.controller.ts src/types/common.ts src/context/AuthContext.tsx
git commit -m "feat: trả enabledModules qua /auth/me và expose trong AuthContext"
```

---

### Task 4: Ẩn module trên Sidebar + chặn điều hướng router

**Files:**
- Modify: `src/pages/Sidebar.tsx` (~dòng 130-140)
- Modify: `src/router/useTabRouter.ts` và/hoặc `src/App.tsx` (nơi resolve tab từ path)

**Interfaces:**
- Consumes: `useAuth().userProfile.enabledModules`, `TAB_MODULE_MAP`, `isModuleEnabled` (Task 1/3).

- [ ] **Step 1: Sidebar lọc menu**

Trong `src/pages/Sidebar.tsx`, import `TAB_MODULE_MAP`, `isModuleEnabled` từ `../config/modules`. Thay dòng 137:

```ts
  // Loại các module bị ẩn tạm + module doanh nghiệp không bật khỏi thanh điều hướng
  const menuItems = baseMenuItems.filter((item) => {
    const moduleKey = TAB_MODULE_MAP[item.label];
    return !moduleKey || isModuleEnabled(userProfile?.enabledModules, moduleKey);
  });
```

(Lưu ý dòng cũ `const menuItems = [...baseMenuItems];` bị thay; các `menuItems.push(...)` phía dưới giữ nguyên.)

- [ ] **Step 2: Chặn truy cập trực tiếp URL của tab bị tắt**

Trong `src/App.tsx` (component nhận `activeTab` từ `useTabRouter`, ~dòng 45), sau khi có `activeTab` và `userProfile`:

```ts
  const blockedModule = TAB_MODULE_MAP[activeTab];
  const isTabBlocked = Boolean(blockedModule) && !isModuleEnabled(userProfile?.enabledModules, blockedModule!);
  useEffect(() => {
    if (isTabBlocked) setActiveTab("TỔNG QUAN" as TabType);
  }, [isTabBlocked]);
```

Import `TAB_MODULE_MAP`, `isModuleEnabled` từ `./config/modules`. Đặt hook đúng thứ tự hook hiện có (không đặt sau early-return). Trong lúc `isTabBlocked` true, render `AppRouterView` với `activeTab="TỔNG QUAN"` để không nháy nội dung tab cấm:

```tsx
<AppRouterView activeTab={isTabBlocked ? ("TỔNG QUAN" as TabType) : activeTab} userProfile={userProfile} />
```

- [ ] **Step 3: Kiểm tra thủ công nhanh**

Run: `yarn dev`, đăng nhập, xác nhận sidebar đầy đủ (company chưa tắt gì). Sửa tạm DB một company: `enabledModules: ["hr"]` → sidebar chỉ còn NHÂN SỰ (+ TỔNG QUAN, Ví...); gõ URL `/kho-san-pham` → về TỔNG QUAN.

- [ ] **Step 4: Typecheck + commit**

```bash
yarn typecheck
git add src/pages/Sidebar.tsx src/App.tsx src/router/useTabRouter.ts
git commit -m "feat: ẩn module tắt khỏi sidebar và chặn điều hướng trực tiếp"
```

---

### Task 5: Ẩn thông tin module tắt trên Tổng quan (DashboardTab)

**Files:**
- Modify: `src/pages/DashboardTab.tsx` (~1758 dòng — các vùng: ModuleCard grid ~dòng 930-1060; widget kho "Doanh thu xuất kho"/"Cảnh báo tồn kho" ~dòng 1100-1300; các fetch đầu file ~dòng 120-200 và đề xuất AI nhập kho ~dòng 731)

**Interfaces:**
- Consumes: `useAuth().userProfile.enabledModules`, `isModuleEnabled`, `ModuleKey`.

- [ ] **Step 1: Thêm helper trong component**

Đầu component (sau `useAuth()`):

```ts
import { isModuleEnabled, type ModuleKey } from "../config/modules";
// ...
const canSee = (key: ModuleKey) => isModuleEnabled(userProfile?.enabledModules, key);
```

- [ ] **Step 2: Bọc điều kiện các khối UI**

- ModuleCard "Nhân sự" (onClick `goToTab("NHÂN SỰ")`, ~dòng 942): bọc `{canSee("hr") && (...)}`
- ModuleCard "Kho & Sản phẩm" (~dòng 944): `{canSee("inventory") && (...)}`
- Card kanban (~dòng 964), lịch (~dòng 1013), đào tạo (~dòng 1054): `{canSee("hr") && (...)}`
- Card học viên (~dòng 979) và học phí (~dòng 998): `{canSee("student") && (...)}`
- Khối "Doanh thu xuất kho" (~dòng 1106, 1263) và "Cảnh báo tồn kho" (~dòng 1119): `{canSee("inventory") && (...)}`
- Grid dùng CSS grid nên tự dồn khi thiếu phần tử — không cần sửa layout.

- [ ] **Step 3: Bỏ qua fetch của module tắt**

Trong các `useEffect` fetch dữ liệu đầu component: guard đầu hàm fetch tương ứng, ví dụ fetch nhân sự (~dòng 180-200): `if (!canSee("hr")) return;`; fetch sản phẩm/tồn kho/xuất kho: `if (!canSee("inventory")) return;`; fetch học viên/học phí: `if (!canSee("student")) return;`. Thêm `userProfile?.enabledModules` vào dependency array nếu cần.

- [ ] **Step 4: Kiểm tra thủ công + typecheck + commit**

Với company `enabledModules: ["hr"]`: Tổng quan chỉ còn card nhân sự/kanban/lịch/đào tạo, không còn widget kho và học viên; console không có request tới API kho/học viên.

```bash
yarn typecheck
git add src/pages/DashboardTab.tsx
git commit -m "feat: ẩn card và widget của module tắt trên Tổng quan"
```

---

### Task 6: Middleware requireModule + gắn vào router (server)

**Files:**
- Create: `server/middleware/require-module.ts`
- Test: `server/middleware/require-module.test.ts`
- Modify: `server/router/index.ts` (~dòng mount các router)
- Modify: `server/router/crud.router.ts` (guard theo `:modelName`)

**Interfaces:**
- Consumes: `MODULE_KEYS`, `ModuleKey`, `isModuleKey` (Task 1); `req.user` do `requireAuth` gắn (`{ id, role, companyCode, ... }`).
- Produces: `requireModule(key: ModuleKey)` — Express middleware; `getEnabledModulesForCompany(code: string): Promise<ModuleKey[]>` (có cache); `clearModuleCache(code?: string)`; `CRUD_MODEL_MODULE_MAP: Record<string, ModuleKey>`.

- [ ] **Step 1: Viết test fail** — `server/middleware/require-module.test.ts`

Tách logic quyết định thành hàm thuần `resolveModuleAccess` để test không cần DB:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { resolveModuleAccess } from "./require-module";

test("superadmin luôn được phép", () => {
  assert.equal(resolveModuleAccess({ role: "superadmin", companyCode: "SYSTEM" }, "hr", []), true);
});

test("company bật module → được phép", () => {
  assert.equal(resolveModuleAccess({ role: "user", companyCode: "ACME" }, "hr", ["hr", "chat"]), true);
});

test("company tắt module → chặn", () => {
  assert.equal(resolveModuleAccess({ role: "admin", companyCode: "ACME" }, "inventory", ["hr"]), false);
});

test("company cũ không có danh sách → bật tất cả", () => {
  assert.equal(resolveModuleAccess({ role: "user", companyCode: "OLD" }, "student", []), true);
  assert.equal(resolveModuleAccess({ role: "user", companyCode: "OLD" }, "student", undefined), true);
});
```

Run: `npx tsx --test server/middleware/require-module.test.ts` → Expected: FAIL (module chưa tồn tại).

- [ ] **Step 2: Viết `server/middleware/require-module.ts`**

```ts
import { Response, NextFunction } from "express";
import { CompanyModel } from "../model/company.model";
import { ModuleKey } from "../config/module-keys";

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { modules: string[] | undefined; expiresAt: number }>();

export function clearModuleCache(code?: string) {
  if (code) cache.delete(code.toUpperCase());
  else cache.clear();
}

/** Logic quyết định thuần — export để test. Danh sách rỗng/undefined = bật tất cả. */
export function resolveModuleAccess(
  user: { role?: string; companyCode?: string } | undefined,
  key: ModuleKey,
  enabledModules: string[] | undefined
): boolean {
  if (user?.role === "superadmin") return true;
  if (!enabledModules || enabledModules.length === 0) return true;
  return enabledModules.includes(key);
}

async function getEnabledModulesForCompany(companyCode: string): Promise<string[] | undefined> {
  const code = companyCode.toUpperCase();
  const hit = cache.get(code);
  if (hit && hit.expiresAt > Date.now()) return hit.modules;
  const company = await CompanyModel.findOne({ code }).select("enabledModules").lean();
  const modules = company?.enabledModules;
  cache.set(code, { modules, expiresAt: Date.now() + CACHE_TTL_MS });
  return modules;
}

/** Chặn 403 nếu module chưa bật cho doanh nghiệp của user. Đặt SAU requireAuth. */
export function requireModule(key: ModuleKey) {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (user?.role === "superadmin" || !user?.companyCode) return next();
      const modules = await getEnabledModulesForCompany(user.companyCode);
      if (resolveModuleAccess(user, key, modules)) return next();
      return res.status(403).json({
        status: "error",
        message: "Module chưa được kích hoạt cho doanh nghiệp của bạn.",
      });
    } catch (error) {
      return next(error); // lỗi hạ tầng không được chặn nhầm request hợp lệ
    }
  };
}
```

Run test → Expected: PASS.

- [ ] **Step 3: Gắn vào router module trong `server/router/index.ts`**

Import: `import { requireModule } from "../middleware/require-module";` rồi sửa các mount (các router này đã tự `requireAuth` bên trong; middleware đọc `req.user` nên phải chắc `requireAuth` chạy trước — với router có `requireAuth` per-route, gắn `requireModule` per-route bên trong file router đó thay vì tại mount nếu `req.user` chưa có ở tầng mount. Kiểm tra từng router: nếu router dùng `router.use(requireAuth)` đầu file thì mount-level không có `req.user`; khi đó thêm `router.use(requireModule("key"))` NGAY SAU dòng `router.use(requireAuth)` trong chính file router).

Mapping cần đạt được:
- `timekeepingRouter`, `kanbanRouter` → `requireModule("hr")`
- `chatRouter`, `chatbotRouter` → `requireModule("chat")`
- `resourceRouter`, `googleDriveRouter` → `requireModule("resource")`
- `studentManagementRouter` → `requireModule("student")` (thêm trong `server/modules/student-management/router.ts` cho các nhánh students/exams/payments/courses/ai/chatbot/student-notifications/upload; GIỮ NGUYÊN `/webhook` không chặn vì là callback bên ngoài không có user)

- [ ] **Step 4: Guard generic CRUD theo modelName**

Trong `server/router/crud.router.ts`, thêm trước các route `/:modelName`:

```ts
import { requireModule } from "../middleware/require-module";
import { ModuleKey } from "../config/module-keys";

const CRUD_MODEL_MODULE_MAP: Record<string, ModuleKey> = {
  products: "inventory", categories: "inventory", stocklogs: "inventory", transactions: "inventory",
  kanbantasks: "hr", workflows: "hr", hrcalendarevents: "hr",
  hrleaveapplications: "hr", hrleavetemplates: "hr", timekeepings: "hr",
  trainingcourses: "hr", trainingenrollments: "hr",
  resources: "resource", resourceitems: "resource",
};

const crudModuleGuard = (req: any, res: any, next: any) => {
  const key = CRUD_MODEL_MODULE_MAP[String(req.params.modelName || "").toLowerCase()];
  if (!key) return next(); // model không thuộc module bật/tắt → cho qua
  return requireModule(key)(req, res, next);
};
```

và chèn `crudModuleGuard` vào chuỗi middleware của 5 route `/:modelName...` (dòng 124-153), sau middleware auth hiện có. **Quan trọng:** đối chiếu tên key trong map với tên modelName thực tế client gọi (grep `"/crud/` trong `src/` để lấy danh sách chính xác, chỉnh map theo đó — tên ở trên là dự đoán từ tên model, PHẢI xác minh).

- [ ] **Step 5: Test + typecheck + commit**

```bash
npx tsx --test server/middleware/require-module.test.ts
yarn typecheck
git add server/middleware/require-module.ts server/middleware/require-module.test.ts server/router/index.ts server/router/crud.router.ts server/modules/student-management/router.ts server/router/chat.router.ts server/router/kanban.router.ts server/router/timekeeping.router.ts server/router/resource.router.ts server/router/chatbot.router.ts server/router/google-drive.router.ts
git commit -m "feat: middleware requireModule chặn API của module chưa kích hoạt"
```

(Chỉ add những file thực sự sửa.)

---

### Task 7: Superadmin sửa enabledModules + UI checkbox (tạo & sửa DN)

**Files:**
- Modify: `server/service/auth.service.ts` (`updateCompany`, ~dòng 404)
- Modify: `server/router/auth.router.ts` (`updateCompanySchema`, ~dòng 236)
- Modify: `src/services/authService.ts` (`registerCompanyAndAdmin` ~dòng 315, `updateCompany` ~dòng 243)
- Modify: `src/pages/UserAdminTab.tsx` (modal tạo DN + modal sửa DN)
- Modify: `src/types/common.ts` (`CompanyProfile`)

**Interfaces:**
- Consumes: `sanitizeModuleKeys`, `clearModuleCache` (server); `MODULE_KEYS`, `MODULE_LABELS` (client).
- Produces: `authService.updateCompany(companyId, { name?, code?, ownerEmail?, enabledModules? })`; `CompanyProfile.enabledModules?: string[]`.

- [ ] **Step 1: Server — updateCompany nhận enabledModules**

`server/service/auth.service.ts` (~dòng 404): mở rộng chữ ký `updateData: { name?: string; code?: string; ownerEmail?: string; enabledModules?: string[] }`. Trong thân hàm, chỗ build update:

```ts
if (updateData.enabledModules !== undefined) {
  company.enabledModules = sanitizeModuleKeys(updateData.enabledModules);
}
```

(đặt trước `company.save()` / lệnh update hiện có — làm theo đúng cách hàm đang ghi các trường khác). Sau khi lưu thành công, gọi `clearModuleCache(company.code)` (import từ `../middleware/require-module`) để middleware nhận thay đổi ngay.

`server/router/auth.router.ts` — `updateCompanySchema.body` thêm:

```ts
enabledModules: Joi.array().items(Joi.string()).optional(),
```

- [ ] **Step 2: Client service** — `src/services/authService.ts`

`registerCompanyAndAdmin`: thêm tham số thứ 6 `enabledModules: string[]` và đưa vào body JSON. `updateCompany`: mở rộng `updateData` với `enabledModules?: string[]` (body đã spread thì tự đi theo). `src/types/common.ts` — `CompanyProfile` thêm `enabledModules?: string[];`.

- [ ] **Step 3: UI — checkbox nhóm module**

`src/pages/UserAdminTab.tsx`:
- State: `const [selectedModules, setSelectedModules] = useState<string[]>([...MODULE_KEYS]);` (import `MODULE_KEYS`, `MODULE_LABELS` từ `../config/modules`).
- Trong modal TẠO doanh nghiệp (form của `handleRegisterCompany`), thêm block trước nút submit:

```tsx
<div>
  <p className="text-sm font-medium text-gray-700 mb-2">Module sử dụng</p>
  <div className="grid grid-cols-2 gap-2">
    {MODULE_KEYS.map((key) => (
      <label key={key} className="flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={selectedModules.includes(key)}
          onChange={(e) =>
            setSelectedModules((prev) => (e.target.checked ? [...prev, key] : prev.filter((k) => k !== key)))
          }
        />
        {MODULE_LABELS[key]}
      </label>
    ))}
  </div>
</div>
```

- `handleRegisterCompany`: validate `if (selectedModules.length === 0) { toast.warning("Vui lòng chọn ít nhất 1 module!"); return; }`; truyền `selectedModules` vào `authService.registerCompanyAndAdmin(...)`; reset về `[...MODULE_KEYS]` sau khi thành công.
- Modal SỬA doanh nghiệp (`editingCompany` / `CompanyEditFormState`): thêm state modules tương tự, khởi tạo từ `editingCompany.enabledModules?.length ? editingCompany.enabledModules : [...MODULE_KEYS]` khi mở modal; render cùng block checkbox; đưa `enabledModules` vào payload `authService.updateCompany(...)` (~dòng 517); validate tối thiểu 1.
- Kiểm tra `getCompanies` server trả trường mới: `CompanyModel.find()` mặc định trả đủ document → chỉ cần chắc mapping client không strip (xem `authService.getCompanies` / nơi build `CompanyProfile`; nếu có pick field thủ công thì thêm `enabledModules`).

- [ ] **Step 4: Kiểm tra thủ công + typecheck + commit**

Superadmin: tạo DN mới chỉ tick 2 module → login bằng admin DN đó thấy đúng 2 module. Sửa DN bật thêm 1 module → user refresh thấy module mới, API hết 403 (cache đã clear).

```bash
yarn typecheck
git add server/service/auth.service.ts server/router/auth.router.ts src/services/authService.ts src/pages/UserAdminTab.tsx src/types/common.ts
git commit -m "feat: superadmin chọn và chỉnh module khi tạo/sửa doanh nghiệp"
```

---

### Task 8: Verification tổng thể

- [ ] **Step 1: Chạy toàn bộ test liên quan**

```bash
npx tsx --test server/middleware/require-module.test.ts server/service/auth-register-modules.test.ts
yarn typecheck
```

Expected: tất cả PASS.

- [ ] **Step 2: Smoke test end-to-end (`yarn dev`)**

1. Superadmin tạo DN `TEST01` chỉ bật `hr` + `chat`.
2. Login admin `TEST01`: sidebar chỉ có NHÂN SỰ, TRÒ CHUYỆN (+ TỔNG QUAN, VÍ, QUẢN TRỊ USER, CÀI ĐẶT); Tổng quan không còn card kho/học viên.
3. Gõ URL `/kho-san-pham` → redirect TỔNG QUAN. Gọi thử `GET /api/v1/crud/products` bằng token user TEST01 → 403 với message tiếng Việt.
4. Superadmin sửa `TEST01` bật thêm `inventory` → user refresh thấy KHO & SẢN PHẨM, API trả 200.
5. Company cũ (không có `enabledModules`): mọi thứ như trước — đủ module.

- [ ] **Step 3: Commit cuối (nếu có sửa lặt vặt) và báo cáo kết quả**
