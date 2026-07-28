# Entity Preset Flash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loại bỏ hoàn toàn khung hình dùng preset giáo dục giả khi doanh nghiệp thực tế dùng preset lao động hoặc loại hình khác.

**Architecture:** Tách trạng thái preset thành một external store dùng chung, được đọc bằng `useSyncExternalStore`, để mọi `useEntityLabel()` dùng cùng snapshot và cùng request. Đồng thời resolve sub-tab không hợp lệ ngay trong render để nội dung giáo dục cũ không tồn tại đến lượt effect sau.

**Tech Stack:** React 19, TypeScript 5.8, Vitest 4, Testing Library, Vite.

## Global Constraints

- Không thay đổi API backend hay schema `ModuleSettings`.
- Không dùng localStorage làm nguồn sự thật cho preset.
- Giữ nguyên interface trả về hiện tại của `useEntityLabel()`.
- Mỗi thay đổi production phải được dẫn dắt bởi một test đã quan sát thất bại đúng nguyên nhân.
- Không refactor module nghiệp vụ không liên quan.

---

## File Structure

- Create `src/modules/student-management/hooks/entityPresetStore.ts`: giữ snapshot, request dùng chung, subscription, browser/socket listener và test reset.
- Create `src/modules/student-management/hooks/entityPresetStore.test.tsx`: kiểm tra request deduplication, consumer mount muộn và cập nhật realtime.
- Modify `src/modules/student-management/hooks/useEntityLabel.ts`: chuyển từ state riêng từng hook sang snapshot của store.
- Create `src/hooks/useSubTabRouter.test.tsx`: kiểm tra route bị loại bỏ được resolve đồng bộ và URL được sửa.
- Modify `src/hooks/useSubTabRouter.ts`: trả active tab hợp lệ ngay trong render và đồng bộ state/URL sau đó.

### Task 1: Shared Entity Preset Store

**Files:**
- Create: `src/modules/student-management/hooks/entityPresetStore.ts`
- Create: `src/modules/student-management/hooks/entityPresetStore.test.tsx`
- Modify: `src/modules/student-management/hooks/useEntityLabel.ts:1-56`

**Interfaces:**
- Consumes: `getModuleSettings(): Promise<{ tenantId: string; entityPreset: EntityPreset }>` and `socketService.on(event, listener): () => void`.
- Produces:
  - `type EntityPresetSnapshot = { preset: EntityPreset; loading: boolean }`
  - `getEntityPresetSnapshot(): EntityPresetSnapshot`
  - `subscribeEntityPreset(listener: () => void): () => void`
  - `ensureEntityPresetLoaded(): Promise<void>`
  - `setEntityPreset(value: unknown): boolean`
  - `resetEntityPresetStoreForTests(): void`

- [ ] **Step 1: Write failing tests for a single shared request and late-mount snapshot**

Create `src/modules/student-management/hooks/entityPresetStore.test.tsx`:

```tsx
// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getModuleSettings } from "../api/moduleSettings.api";
import { socketService } from "../../../services/socketService";
import { useEntityLabel } from "./useEntityLabel";
import { resetEntityPresetStoreForTests } from "./entityPresetStore";

vi.mock("../api/moduleSettings.api", () => ({ getModuleSettings: vi.fn() }));
vi.mock("../../../services/socketService", () => ({
  socketService: { on: vi.fn(() => () => undefined) },
}));

function Probe({ name, onRender }: { name: string; onRender?: (preset: string) => void }) {
  const entity = useEntityLabel();
  onRender?.(entity.preset);
  return <output aria-label={name}>{entity.loading ? "loading" : entity.preset}</output>;
}

describe("shared entity preset state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetEntityPresetStoreForTests();
  });
  afterEach(cleanup);

  it("shares one settings request across simultaneous consumers", async () => {
    vi.mocked(getModuleSettings).mockResolvedValue({ tenantId: "ACME", entityPreset: "worker" });
    render(<><Probe name="first" /><Probe name="second" /></>);
    await waitFor(() => expect(screen.getByLabelText("first")).toHaveTextContent("worker"));
    expect(screen.getByLabelText("second")).toHaveTextContent("worker");
    expect(getModuleSettings).toHaveBeenCalledTimes(1);
  });

  it("gives a late-mounted consumer the resolved worker preset on its first render", async () => {
    vi.mocked(getModuleSettings).mockResolvedValue({ tenantId: "ACME", entityPreset: "worker" });
    const lateRenders: string[] = [];
    const view = render(<Probe name="first" />);
    await waitFor(() => expect(screen.getByLabelText("first")).toHaveTextContent("worker"));
    view.rerender(<><Probe name="first" /><Probe name="late" onRender={(preset) => lateRenders.push(preset)} /></>);
    expect(screen.getByLabelText("late")).toHaveTextContent("worker");
    expect(lateRenders).toEqual(["worker"]);
  });
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npx vitest run src/modules/student-management/hooks/entityPresetStore.test.tsx
```

Expected: FAIL because `./entityPresetStore` does not exist. After adding only an empty exported reset to allow collection, the behavioral tests must still FAIL because two hook instances call `getModuleSettings()` separately and the late consumer initially renders `student`.

- [ ] **Step 3: Implement the minimal shared store**

Create `entityPresetStore.ts` with one immutable snapshot object, a `Set<() => void>` of subscribers and one `loadPromise`. `setEntityPreset` validates against `ENTITY_PRESETS`, replaces the snapshot with `{ preset: value, loading: false }`, then calls every subscriber. `ensureEntityPresetLoaded` must:

```ts
if (!snapshot.loading || loadPromise) return loadPromise ?? Promise.resolve();
loadPromise = getModuleSettings()
  .then((settings) => {
    setEntityPreset(settings.entityPreset);
  })
  .catch(() => {
    setEntityPreset(DEFAULT_ENTITY_PRESET);
  })
  .finally(() => {
    loadPromise = null;
  });
return loadPromise;
```

`subscribeEntityPreset` installs the window listener and socket listener only when the first subscriber arrives, and removes them after the final subscriber leaves. A valid event calls `setEntityPreset`; an invalid browser event sets `{ ...snapshot, loading: true }`, publishes, and calls `ensureEntityPresetLoaded()`.

`resetEntityPresetStoreForTests()` must remove installed listeners, clear subscribers and `loadPromise`, then restore a stable initial snapshot `{ preset: DEFAULT_ENTITY_PRESET, loading: true }`.

Replace local `useState`/`useEffect` in `useEntityLabel.ts` with:

```ts
const snapshot = useSyncExternalStore(
  subscribeEntityPreset,
  getEntityPresetSnapshot,
  getEntityPresetSnapshot,
);

useEffect(() => {
  void ensureEntityPresetLoaded();
}, []);

return {
  ...ENTITY_LABEL_PRESETS[snapshot.preset],
  preset: snapshot.preset,
  loading: snapshot.loading,
};
```

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```powershell
npx vitest run src/modules/student-management/hooks/entityPresetStore.test.tsx
```

Expected: 2 tests PASS; `getModuleSettings` called once.

- [ ] **Step 5: Add failing realtime synchronization tests**

Append tests that capture the registered callbacks:

```tsx
it("updates every consumer from a browser event", async () => {
  vi.mocked(getModuleSettings).mockResolvedValue({ tenantId: "ACME", entityPreset: "student" });
  render(<><Probe name="first" /><Probe name="second" /></>);
  await waitFor(() => expect(screen.getByLabelText("first")).toHaveTextContent("student"));
  act(() => window.dispatchEvent(new CustomEvent("entity-label:changed", {
    detail: { entityPreset: "worker" },
  })));
  expect(screen.getByLabelText("first")).toHaveTextContent("worker");
  expect(screen.getByLabelText("second")).toHaveTextContent("worker");
});

it("updates every consumer from the socket listener", async () => {
  vi.mocked(getModuleSettings).mockResolvedValue({ tenantId: "ACME", entityPreset: "student" });
  render(<><Probe name="first" /><Probe name="second" /></>);
  await waitFor(() => expect(screen.getByLabelText("first")).toHaveTextContent("student"));
  const listener = vi.mocked(socketService.on).mock.calls
    .find(([event]) => event === "entity_preset_changed")?.[1];
  act(() => listener?.({ entityPreset: "customer" }));
  expect(screen.getByLabelText("first")).toHaveTextContent("customer");
  expect(screen.getByLabelText("second")).toHaveTextContent("customer");
});
```

- [ ] **Step 6: Run realtime tests and verify expected RED, then GREEN**

First run before completing listener ownership:

```powershell
npx vitest run src/modules/student-management/hooks/entityPresetStore.test.tsx
```

Expected RED: one or both probes remain `student`.

Complete the listener installation described in Step 3 and rerun the same command.

Expected GREEN: 4 tests PASS and only one socket subscription exists for all hook consumers.

- [ ] **Step 7: Commit Task 1**

```powershell
git add -- src/modules/student-management/hooks/entityPresetStore.ts src/modules/student-management/hooks/entityPresetStore.test.tsx src/modules/student-management/hooks/useEntityLabel.ts
git commit -m "fix(student): share entity preset state across views"
```

### Task 2: Synchronous Invalid Sub-tab Resolution

**Files:**
- Create: `src/hooks/useSubTabRouter.test.tsx`
- Modify: `src/hooks/useSubTabRouter.ts:16-59`

**Interfaces:**
- Consumes: `SubTabRouteMap<T>` and `defaultValue: T`.
- Produces: unchanged hook interface `[T, (tab: T) => void]`, with returned `T` always present in the current route map or equal to `defaultValue`.

- [ ] **Step 1: Write the failing route-removal regression test**

Create `src/hooks/useSubTabRouter.test.tsx`:

```tsx
// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useSubTabRouter, type SubTabRouteMap } from "./useSubTabRouter";

type Tab = "OVERVIEW" | "FEES";

function Probe({ routes }: { routes: SubTabRouteMap<Tab> }) {
  const [active] = useSubTabRouter(routes, "OVERVIEW");
  return <output aria-label="active">{active}</output>;
}

afterEach(cleanup);

it("does not render a removed active route for an extra frame", () => {
  window.history.replaceState(null, "", "/?sub=fees");
  const allRoutes: SubTabRouteMap<Tab> = [
    { slug: "overview", value: "OVERVIEW" },
    { slug: "fees", value: "FEES" },
  ];
  const workerRoutes: SubTabRouteMap<Tab> = [
    { slug: "overview", value: "OVERVIEW" },
  ];
  const view = render(<Probe routes={allRoutes} />);
  expect(screen.getByLabelText("active")).toHaveTextContent("FEES");

  act(() => view.rerender(<Probe routes={workerRoutes} />));

  expect(screen.getByLabelText("active")).toHaveTextContent("OVERVIEW");
  expect(new URLSearchParams(window.location.search).get("sub")).toBe("overview");
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npx vitest run src/hooks/useSubTabRouter.test.tsx
```

Expected: FAIL immediately after `rerender`, receiving `FEES` because the existing hook corrects state only in `useEffect`.

- [ ] **Step 3: Implement synchronous active-value resolution**

In `useSubTabRouter`, derive the returned value synchronously:

```ts
const isStateValid = routeMap.some((entry) => entry.value === activeSubTab);
const resolvedActiveSubTab = isStateValid ? activeSubTab : defaultValue;
```

Return `resolvedActiveSubTab`, not raw state. Keep an effect that detects `activeSubTab !== resolvedActiveSubTab`, writes `resolvedActiveSubTab` to state and updates the URL using the matching current route. Extract a local `replaceSubTabInUrl(tab)` callback and reuse it in both the correction effect and `setActiveSubTab`.

The correction effect must set `?sub=overview` when the default has a mapped route, matching the same URL policy used by explicit tab selection.

- [ ] **Step 4: Run focused test and verify GREEN**

Run:

```powershell
npx vitest run src/hooks/useSubTabRouter.test.tsx
```

Expected: 1 test PASS and the assertion sees `OVERVIEW` in the same rerender.

- [ ] **Step 5: Commit Task 2**

```powershell
git add -- src/hooks/useSubTabRouter.ts src/hooks/useSubTabRouter.test.tsx
git commit -m "fix(student): resolve hidden sub-tabs synchronously"
```

### Task 3: Regression and Build Verification

**Files:**
- Verify: `src/modules/student-management/hooks/entityPresetStore.test.tsx`
- Verify: `src/hooks/useSubTabRouter.test.tsx`
- Verify: existing TypeScript sources.

**Interfaces:**
- Consumes: completed Tasks 1 and 2.
- Produces: verified fix with no additional production behavior.

- [ ] **Step 1: Run all directly related tests**

```powershell
npx vitest run src/modules/student-management/hooks/entityPresetStore.test.tsx src/hooks/useSubTabRouter.test.tsx src/modules/student-management/config/entityLabels.test.ts src/modules/student-management/config/workerRecruitmentCopy.test.ts
```

Expected: all tests PASS with no unhandled errors or React `act` warnings.

- [ ] **Step 2: Run the complete test suite**

```powershell
npx vitest run
```

Expected: PASS. If an unrelated pre-existing failure appears, record its exact test and output; do not alter unrelated production code.

- [ ] **Step 3: Run TypeScript validation**

```powershell
npm run typecheck
```

Expected: exit code 0 with no TypeScript diagnostics.

- [ ] **Step 4: Run production build**

```powershell
npm run build
```

Expected: Vite and server bundle complete with exit code 0.

- [ ] **Step 5: Inspect the final diff**

```powershell
git diff --check
git status --short
git log -3 --oneline
```

Expected: no whitespace errors; only intended files are modified or committed; two implementation commits follow the design/plan commits.
