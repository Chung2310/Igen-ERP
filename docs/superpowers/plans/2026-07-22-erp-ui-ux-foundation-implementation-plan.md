# iGen ERP UI/UX Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared UI/UX foundation that reduces information overload across iGen ERP while preserving every existing feature and business behavior.

**Architecture:** Introduce typed navigation and feature-inventory contracts, then standardize reusable page, table, modal, drawer, and state components. Adopt the foundation first in the application shell and one representative student-management list page; migrate remaining modules through separate follow-on plans after the contracts are verified.

**Tech Stack:** React 19, TypeScript 5.8, Tailwind CSS 4, Lucide React, Vitest 4, Testing Library.

## Global Constraints

- Preserve every existing module, feature, permission, workflow, API, data structure, calculation, validation rule, and business result.
- Current Vietnamese product copy remains unchanged except for technical display defects such as encoding errors.
- Frequent features require no more than two steps; advanced features require no more than three.
- Each screen has one visually dominant primary action.
- Tables show no more than seven columns by default unless a business exception is documented.
- Main text is at least 14 pixels and secondary text is at least 12 pixels unless a documented exception exists.
- Do not overwrite or silently absorb pre-existing uncommitted changes in `src/pages/Sidebar.tsx`, `src/components/common/ConfirmModal.tsx`, `src/components/common/DataTable.tsx`, or `src/components/common/RightDrawer.tsx`; audit and preserve their intent first.

---

## File map

- `src/config/modules.ts`: existing access filtering; remains the authority for enabled modules.
- `src/config/navigation.ts`: new typed system-navigation registry and group metadata.
- `src/config/feature-inventory.ts`: new feature-preservation registry used by tests and later module migrations.
- `src/pages/Sidebar.tsx`: renders the registry after reconciling current uncommitted work.
- `src/pages/Header.tsx`: keeps search, notifications, and account entry points while moving utility presentation into focused components.
- `src/components/layout/HeaderSearch.tsx`: global feature/data search UI.
- `src/components/layout/HeaderUtilities.tsx`: credit, theme, and utility actions.
- `src/components/layout/HeaderAccountMenu.tsx`: account entry point and profile menu.
- `src/components/common/PageHeader.tsx`: consistent title and action hierarchy.
- `src/components/common/DataToolbar.tsx`: consistent search, filters, columns, density, and primary-action area.
- `src/components/common/DataTable.tsx`: typed table state and responsive presentation.
- `src/components/common/RightDrawer.tsx`: accessible secondary/deep-information surface.
- `src/components/common/ConfirmModal.tsx`: accessible confirmation surface.
- `src/components/common/ViewState.tsx`: shared loading, empty, no-results, error, and forbidden states.
- `src/modules/student-management/pages/Resources/ResourcesPage.tsx`: pilot list-page adoption.

### Task 1: Create the feature-preservation inventory

**Files:**
- Create: `src/config/feature-inventory.ts`
- Create: `src/config/feature-inventory.test.ts`

**Interfaces:**
- Produces: `FeatureInventoryItem`, `FEATURE_INVENTORY`, `getFeaturesForModule(tab)`, and `getFeatureById(id)`.
- Consumes: `TabType` from `src/types/index.ts` and route labels already used by `src/router/route-config.tsx`.

- [ ] **Step 1: Write the failing inventory contract test**

```ts
import { describe, expect, it } from "vitest";
import { APP_ROUTES } from "../router/route-config";
import { FEATURE_INVENTORY } from "./feature-inventory";

describe("FEATURE_INVENTORY", () => {
  it("maps every application route to at least one discoverable feature", () => {
    for (const route of APP_ROUTES) {
      expect(FEATURE_INVENTORY.some((item) => item.module === route.tab)).toBe(true);
    }
  });

  it("uses unique stable feature ids and valid access depths", () => {
    const ids = FEATURE_INVENTORY.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(FEATURE_INVENTORY.every((item) => item.accessDepth >= 1 && item.accessDepth <= 3)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/config/feature-inventory.test.ts`

Expected: FAIL because `src/config/feature-inventory.ts` does not exist.

- [ ] **Step 3: Implement the inventory types and complete top-level route coverage**

```ts
import type { TabType } from "../types";
import { APP_ROUTES } from "../router/route-config";
import { tabToPath } from "../seo/seo-config";

export type FeatureSurface = "navigation" | "page" | "drawer" | "modal" | "overflow";

export interface FeatureInventoryItem {
  id: string;
  module: TabType;
  label: string;
  entryPoint: string;
  surface: FeatureSurface;
  accessDepth: 1 | 2 | 3;
}

export const FEATURE_INVENTORY: FeatureInventoryItem[] = APP_ROUTES.map((route) => ({
  id: `route.${tabToPath(route.tab).replace(/^\//, "").replaceAll("/", ".")}`,
  module: route.tab,
  label: route.tab,
  entryPoint: tabToPath(route.tab),
  surface: "navigation",
  accessDepth: 1,
}));

export const getFeaturesForModule = (module: TabType) =>
  FEATURE_INVENTORY.filter((item) => item.module === module);

export const getFeatureById = (id: string) =>
  FEATURE_INVENTORY.find((item) => item.id === id);
```

- [ ] **Step 4: Run inventory and route tests**

Run: `npx vitest run src/config/feature-inventory.test.ts src/config/modules.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the inventory**

```bash
git add src/config/feature-inventory.ts src/config/feature-inventory.test.ts
git commit -m "test: inventory ERP feature entry points"
```

### Task 2: Extract a typed system-navigation registry

**Files:**
- Create: `src/config/navigation.ts`
- Create: `src/config/navigation.test.ts`
- Modify: `src/pages/Sidebar.tsx`

**Interfaces:**
- Consumes: `filterEnabledTabs()` from `src/config/modules.ts` and role data from `UserProfile`.
- Produces: `NavigationGroupId`, `NavigationItem`, `NAVIGATION_GROUPS`, and `getNavigationItems(profile)`.

- [ ] **Step 1: Write failing navigation tests**

```ts
import { describe, expect, it } from "vitest";
import { getNavigationItems, NAVIGATION_GROUPS } from "./navigation";

describe("getNavigationItems", () => {
  it("keeps group order stable and hides user administration from employees", () => {
    expect(NAVIGATION_GROUPS.map((group) => group.id)).toEqual(["main", "operations", "tools", "system"]);
    const items = getNavigationItems({ role: "employee", enabledModules: [] } as never);
    expect(items.some((item) => item.id === "user-admin")).toBe(false);
  });

  it("shows user administration to administrators", () => {
    const items = getNavigationItems({ role: "admin", enabledModules: [] } as never);
    expect(items.some((item) => item.id === "user-admin")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/config/navigation.test.ts`

Expected: FAIL because `src/config/navigation.ts` does not exist.

- [ ] **Step 3: Implement the registry and reconcile the current sidebar diff**

Define `NavigationItem` with `id`, `tab`, `label`, `icon`, `group`, and optional `roles`. Move menu data and group ordering out of `Sidebar.tsx`. Keep the current compact grouped visual treatment, enabled-module filtering, mobile close behavior, desktop collapse behavior, and legal links. Do not change current Vietnamese labels.

```ts
export type NavigationGroupId = "main" | "operations" | "tools" | "system";

export interface NavigationItem {
  id: string;
  tab: TabType;
  label: string;
  icon: LucideIcon;
  group: NavigationGroupId;
  roles?: UserProfile["role"][];
}
```

- [ ] **Step 4: Run navigation tests and typecheck**

Run: `npx vitest run src/config/navigation.test.ts src/config/modules.test.ts && npm run typecheck`

Expected: tests PASS and TypeScript exits with code 0.

- [ ] **Step 5: Commit navigation extraction**

```bash
git add src/config/navigation.ts src/config/navigation.test.ts src/pages/Sidebar.tsx
git commit -m "refactor: centralize ERP navigation metadata"
```

### Task 3: Stabilize accessible shared overlays

**Files:**
- Modify: `src/components/common/ConfirmModal.tsx`
- Modify: `src/components/common/RightDrawer.tsx`
- Create: `src/components/common/ConfirmModal.test.tsx`
- Create: `src/components/common/RightDrawer.test.tsx`

**Interfaces:**
- Produces: the existing `ConfirmModalProps` and `RightDrawerProps` without breaking callers.
- Adds: `initialFocusRef?: React.RefObject<HTMLElement | null>` and Escape-key close behavior.

- [ ] **Step 1: Write failing accessibility tests**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmModal } from "./ConfirmModal";

it("exposes a named modal and closes on Escape", async () => {
  const onClose = vi.fn();
  render(<ConfirmModal isOpen onClose={onClose} onConfirm={vi.fn()} title="Confirm action" description="Check the action" />);
  expect(screen.getByRole("dialog", { name: "Confirm action" })).toBeTruthy();
  await userEvent.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledOnce();
});
```

Create the equivalent drawer test with `role="dialog"`, `aria-modal="true"`, title association, Escape close, and body-scroll restoration.

- [ ] **Step 2: Run the overlay tests and verify they fail**

Run: `npx vitest run src/components/common/ConfirmModal.test.tsx src/components/common/RightDrawer.test.tsx`

Expected: FAIL because the current overlays lack the dialog contract and Escape behavior.

- [ ] **Step 3: Implement the minimal accessible behavior**

Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, unique title ids via `React.useId()`, Escape listeners while open, and focus restoration to the previously focused element. Preserve existing props, visuals, text, and callback semantics.

- [ ] **Step 4: Run overlay tests and typecheck**

Run: `npx vitest run src/components/common/ConfirmModal.test.tsx src/components/common/RightDrawer.test.tsx && npm run typecheck`

Expected: PASS and TypeScript exits with code 0.

- [ ] **Step 5: Commit overlay stabilization**

```bash
git add src/components/common/ConfirmModal.tsx src/components/common/RightDrawer.tsx src/components/common/ConfirmModal.test.tsx src/components/common/RightDrawer.test.tsx
git commit -m "feat: standardize accessible ERP overlays"
```

### Task 4: Split table responsibilities into reusable contracts

**Files:**
- Create: `src/components/common/DataToolbar.tsx`
- Create: `src/components/common/ViewState.tsx`
- Modify: `src/components/common/DataTable.tsx`
- Create: `src/components/common/DataTable.test.tsx`

**Interfaces:**
- Produces: `DataToolbarProps`, `ViewStateProps`, `DataTableProps<T>`, and `Column<T>`.
- Preserves existing `DataTable` props so later module adoption is incremental.
- Adds: `density?: "comfortable" | "compact"`, `filters?: React.ReactNode`, `advancedFilterAction?: React.ReactNode`, and controlled `searchValue`/`onSearchChange` support.

- [ ] **Step 1: Write failing table behavior tests**

```tsx
it("limits default columns, filters rows, and exposes hidden columns", async () => {
  const user = userEvent.setup();
  render(<DataTable columns={columns} data={rows} keyExtractor={(row) => row.id} />);
  expect(screen.getAllByRole("columnheader")).toHaveLength(7);
  await user.type(screen.getByRole("searchbox"), "Nguyen");
  expect(screen.getByText("Nguyen Van A")).toBeTruthy();
  expect(screen.queryByText("Tran Van B")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Tuy chinh cot" }));
  expect(screen.getByRole("menu", { name: "Cot hien thi" })).toBeTruthy();
});
```

Add tests for loading, error retry, empty action, no-results state, page reset after search, selection limited to the visible page, and compact density.

- [ ] **Step 2: Run the table tests and verify they fail**

Run: `npx vitest run src/components/common/DataTable.test.tsx`

Expected: FAIL because toolbar/state contracts and accessibility names do not yet exist.

- [ ] **Step 3: Implement focused components and preserve table behavior**

Move toolbar rendering into `DataToolbar`. Move loading, error, empty, and no-results rendering into `ViewState`. Keep filtering, sorting, pagination, selection, row actions, and column choice inside `DataTable`. Use buttons with accessible names and render the column picker as an identified menu.

- [ ] **Step 4: Run table tests and typecheck**

Run: `npx vitest run src/components/common/DataTable.test.tsx && npm run typecheck`

Expected: PASS and TypeScript exits with code 0.

- [ ] **Step 5: Commit table foundation**

```bash
git add src/components/common/DataToolbar.tsx src/components/common/ViewState.tsx src/components/common/DataTable.tsx src/components/common/DataTable.test.tsx
git commit -m "feat: add reusable ERP data-surface components"
```

### Task 5: Decompose the global header without changing behavior

**Files:**
- Create: `src/components/layout/HeaderSearch.tsx`
- Create: `src/components/layout/HeaderUtilities.tsx`
- Create: `src/components/layout/HeaderAccountMenu.tsx`
- Modify: `src/pages/Header.tsx`
- Create: `src/pages/Header.test.tsx`

**Interfaces:**
- Preserves: `HeaderProps { currentTab, onSearchSelect, onMenuClick }`.
- Produces: focused presentational components whose events are handled by `Header.tsx`.
- Keeps all existing search destinations, notification behavior, wallet status, theme behavior, Telegram state, and logout behavior.

- [ ] **Step 1: Write a header feature-preservation test**

```tsx
it("keeps primary header entry points discoverable", () => {
  renderHeader();
  expect(screen.getByRole("searchbox")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Thong bao" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Tai khoan" })).toBeTruthy();
});
```

Add tests that search calls `onSearchSelect` with the existing tab/subtab pair, the mobile menu calls `onMenuClick`, and utility actions remain reachable from the utilities or account menu.

- [ ] **Step 2: Run the header tests before extraction**

Run: `npx vitest run src/pages/Header.test.tsx`

Expected: at least one FAIL because icon-only controls lack stable accessible names.

- [ ] **Step 3: Extract presentation while retaining state and effects**

Keep API calls, socket listeners, and state ownership in `Header.tsx`. Extract only JSX and callbacks into the three layout components. Add accessible labels and tooltips without rewriting current visible Vietnamese copy. Keep search, notifications, and account visible; place secondary utilities behind one clearly labeled utility entry point.

- [ ] **Step 4: Run header tests, focused service tests, and typecheck**

Run: `npx vitest run src/pages/Header.test.tsx src/services/walletService.test.ts src/services/notificationService.test.ts --passWithNoTests && npm run typecheck`

Expected: Header tests PASS, available service tests PASS, and TypeScript exits with code 0.

- [ ] **Step 5: Commit header decomposition**

```bash
git add src/components/layout/HeaderSearch.tsx src/components/layout/HeaderUtilities.tsx src/components/layout/HeaderAccountMenu.tsx src/pages/Header.tsx src/pages/Header.test.tsx
git commit -m "refactor: simplify the global ERP header"
```

### Task 6: Adopt the standard list template in one pilot module

**Files:**
- Create: `src/components/common/PageHeader.tsx`
- Create: `src/components/common/PageHeader.test.tsx`
- Modify: `src/modules/student-management/pages/Resources/ResourcesPage.tsx`
- Create: `src/modules/student-management/pages/Resources/ResourcesPage.test.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `DataTable`, `DataToolbar`, `ViewState`, `RightDrawer`, and `ConfirmModal` from earlier tasks.
- Preserves: all resource actions, filters, dialogs, navigation, and service calls already present in `ResourcesPage`.

- [ ] **Step 1: Write pilot feature-preservation tests**

```tsx
it("keeps resource search, filters, create, booking, categories, and row actions reachable", () => {
  renderResourcesPage();
  expect(screen.getByRole("searchbox")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Them tai nguyen" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Bo loc" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Quan ly danh muc" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Dat lich" })).toBeTruthy();
});
```

Use the exact current Vietnamese accessible names from the page when implementing the test; the ASCII text above documents intent only.

- [ ] **Step 2: Run the pilot test before migration**

Run: `npx vitest run src/modules/student-management/pages/Resources/ResourcesPage.test.tsx`

Expected: FAIL until the test harness mocks the existing services and the standard entry points are wired.

- [ ] **Step 3: Migrate layout only**

Replace local page-header, toolbar, state, confirmation, and drawer markup with shared components. Keep existing state variables, handlers, service calls, validation, and visible Vietnamese text. Default to no more than seven visible columns; put remaining columns in the column picker. Keep every pre-migration action reachable within three steps.

- [ ] **Step 4: Run pilot and shared-component tests**

Run: `npx vitest run src/modules/student-management/pages/Resources/ResourcesPage.test.tsx src/components/common/*.test.tsx && npm run typecheck`

Expected: PASS and TypeScript exits with code 0.

- [ ] **Step 5: Commit the pilot adoption**

```bash
git add src/components/common/PageHeader.tsx src/components/common/PageHeader.test.tsx src/modules/student-management/pages/Resources/ResourcesPage.tsx src/modules/student-management/pages/Resources/ResourcesPage.test.tsx
git commit -m "refactor: adopt standard UX in resource lists"
```

### Task 7: Verify foundation and prepare module-specific migrations

**Files:**
- Create: `docs/superpowers/plans/2026-07-22-erp-ui-ux-module-migration-roadmap.md`
- Modify: `src/config/feature-inventory.ts`

**Interfaces:**
- Consumes: all shared contracts and pilot results.
- Produces: a migration roadmap with one independently executable plan for HR, Inventory, Student Management, Resources, Chat, User Administration, Wallet, Settings, and remaining modules.

- [ ] **Step 1: Expand the inventory from route-level to feature-level coverage**

Use current subtab registries, visible navigation, handlers, modal triggers, and page actions to record each existing feature with its entry point and access depth. Do not infer deletion of apparently unused code; mark it for manual verification instead.

- [ ] **Step 2: Run automated verification**

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npx vitest run`

Expected: all tests PASS.

Run: `npm run build`

Expected: Vite and server bundles complete successfully.

- [ ] **Step 3: Perform desktop and mobile smoke checks**

Verify login, sidebar expansion/collapse, module navigation, global search, notifications, account menu, pilot list search, filtering, column selection, pagination, create flow, edit flow, delete confirmation, loading, empty, error, and forbidden states. Repeat at desktop and mobile viewport widths.

- [ ] **Step 4: Write the migration roadmap**

For each remaining module, record the exact pages, feature-inventory ids, shared components to adopt, regression tests required, and a separate plan filename. Order migrations as Resources, Student Management, Inventory, HR, User Administration, Settings and Wallet, then Chat because Chat has the largest interaction surface.

- [ ] **Step 5: Commit verified foundation and roadmap**

```bash
git add src/config/feature-inventory.ts docs/superpowers/plans/2026-07-22-erp-ui-ux-module-migration-roadmap.md
git commit -m "docs: map ERP UI UX module migrations"
```

## Execution boundary

This plan deliberately stops after the shared foundation and one pilot migration. Each remaining module receives its own implementation plan so reviewers can reject or approve a module migration without coupling it to unrelated business areas.
