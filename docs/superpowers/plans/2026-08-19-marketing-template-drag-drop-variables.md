# Marketing Template Drag-Drop Variables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw `{{variable}}` editing in Marketing templates with a friendly drag-drop token editor for both subject and body while preserving backend token storage and preview behavior.

**Architecture:** Keep backend template rendering unchanged. Build a frontend token registry plus parse/serialize helpers, then replace the current input/textarea editor with token-aware editors that render friendly chips and a draggable variable palette. Serialize editor state back to raw `{{...}}` strings on every `onChange`.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, existing Marketing module APIs and backend token renderer.

## Global Constraints

- Keep backend token format exactly as `{{key}}`.
- Do not migrate existing stored templates.
- Scope only the Marketing module (`thank_you`, `birthday`, `holiday`, `remarketing`).
- Preserve preview behavior via `fillSampleValues(...)`.
- Follow TDD: failing test first, then minimal implementation.

---

### Task 1: Introduce frontend variable registry and token codec

**Files:**
- Create: `src/modules/marketing/components/marketingVariableRegistry.ts`
- Create: `src/modules/marketing/components/marketingTemplateTokenCodec.ts`
- Modify: `src/modules/marketing/components/TemplateEditor.test.tsx`

**Interfaces:**
- Consumes: `MarketingAutomationType` from `src/modules/marketing/api/marketing.api`
- Produces:
  - `MARKETING_VARIABLE_REGISTRY: Record<string, { label: string; sample: string; types: MarketingAutomationType[] }>`
  - `getVariablesForType(type: MarketingAutomationType): string[]`
  - `toFriendlyTokens(raw: string): string`
  - `toRawTokens(friendly: string): string`
  - `fillSampleValues(template: string): string`

- [ ] **Step 1: Write the failing tests**

Add tests that assert:

```tsx
expect(toFriendlyTokens("Cảm ơn {{customerName}}")).toBe("Cảm ơn [Tên khách hàng]");
expect(toRawTokens("Cảm ơn [Tên khách hàng]")).toBe("Cảm ơn {{customerName}}");
expect(toRawTokens("[Biến lạ]")).toBe("[Biến lạ]");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest.cmd run src/modules/marketing/components/TemplateEditor.test.tsx --maxWorkers=1`

Expected: FAIL with missing exports/functions for token conversion.

- [ ] **Step 3: Write minimal implementation**

Create a focused registry and codec module that:

- maps keys to labels/samples/types
- converts `{{customerName}}` ↔ `[Tên khách hàng]`
- leaves unknown placeholders untouched
- re-exports `fillSampleValues(...)` behavior using the registry

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest.cmd run src/modules/marketing/components/TemplateEditor.test.tsx --maxWorkers=1`

Expected: PASS for codec-related assertions.

- [ ] **Step 5: Commit**

```bash
git add src/modules/marketing/components/marketingVariableRegistry.ts src/modules/marketing/components/marketingTemplateTokenCodec.ts src/modules/marketing/components/TemplateEditor.test.tsx
git commit -m "feat(marketing): add friendly variable token codec"
```

### Task 2: Add reusable variable palette with click and drag support

**Files:**
- Create: `src/modules/marketing/components/MarketingVariablePalette.tsx`
- Modify: `src/modules/marketing/components/TemplateEditor.test.tsx`

**Interfaces:**
- Consumes:
  - `getVariablesForType(type)` from `marketingVariableRegistry.ts`
- Produces:
  - `MarketingVariablePalette(props: { automationType: MarketingAutomationType; disabled: boolean; onInsert: (key: string) => void; onDragStart: (key: string) => void; activeTarget: "subject" | "html" })`

- [ ] **Step 1: Write the failing tests**

Add tests that assert:

```tsx
expect(screen.getByRole("button", { name: /Tên khách hàng/i })).toBeTruthy();
expect(screen.queryByRole("button", { name: /Mã đơn hàng/i })).toBeNull(); // for birthday
fireEvent.click(screen.getByRole("button", { name: /Tên khách hàng/i }));
expect(onInsert).toHaveBeenCalledWith("customerName");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest.cmd run src/modules/marketing/components/TemplateEditor.test.tsx --maxWorkers=1`

Expected: FAIL because palette component/behavior does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create a palette component that:

- lists only variables allowed by automation type
- shows friendly labels and sample tooltips
- supports click insertion
- marks variable pills as draggable with `dataTransfer.setData("text/marketing-variable", key)`

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest.cmd run src/modules/marketing/components/TemplateEditor.test.tsx --maxWorkers=1`

Expected: PASS for palette rendering and click behavior.

- [ ] **Step 5: Commit**

```bash
git add src/modules/marketing/components/MarketingVariablePalette.tsx src/modules/marketing/components/TemplateEditor.test.tsx
git commit -m "feat(marketing): add draggable variable palette"
```

### Task 3: Replace raw input/textarea editing with friendly token editors

**Files:**
- Modify: `src/modules/marketing/components/TemplateEditor.tsx`
- Modify: `src/modules/marketing/components/TemplateEditor.test.tsx`

**Interfaces:**
- Consumes:
  - `MarketingVariablePalette`
  - `toFriendlyTokens(raw: string): string`
  - `toRawTokens(friendly: string): string`
- Produces:
  - `TemplateEditor` that displays `[Tên khách hàng]` style tokens in subject and body editors
  - `onChange({ subject })` / `onChange({ html })` still emit raw `{{...}}` strings

- [ ] **Step 1: Write the failing tests**

Add tests that assert:

```tsx
render(<TemplateEditor automationType="thank_you" subject="Cảm ơn {{customerName}}" html="<p>{{orderCode}}</p>" ... />);
expect(screen.queryByDisplayValue(/{{customerName}}/)).toBeNull();
expect(screen.getByDisplayValue(/Tên khách hàng/)).toBeTruthy();
```

And:

```tsx
fireEvent.focus(screen.getByLabelText("Tiêu đề"));
fireEvent.click(screen.getByRole("button", { name: /Tên khách hàng/i }));
expect(onChange).toHaveBeenCalledWith({ subject: "Chúc mừng {{customerName}}" });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest.cmd run src/modules/marketing/components/TemplateEditor.test.tsx --maxWorkers=1`

Expected: FAIL because editor still shows raw token strings.

- [ ] **Step 3: Write minimal implementation**

Update `TemplateEditor` to:

- derive friendly display values from raw props
- keep active target state for subject/body
- on text changes, convert friendly token text back to raw token text
- use regular text controls for now, but display friendly token labels
- wire palette click insertion through codec conversion

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest.cmd run src/modules/marketing/components/TemplateEditor.test.tsx --maxWorkers=1`

Expected: PASS for friendly display and raw output behavior.

- [ ] **Step 5: Commit**

```bash
git add src/modules/marketing/components/TemplateEditor.tsx src/modules/marketing/components/TemplateEditor.test.tsx
git commit -m "feat(marketing): show friendly variable labels in editor"
```

### Task 4: Add drag-drop insertion for subject and body

**Files:**
- Modify: `src/modules/marketing/components/TemplateEditor.tsx`
- Modify: `src/modules/marketing/components/TemplateEditor.test.tsx`

**Interfaces:**
- Consumes:
  - drag payload `"text/marketing-variable"`
- Produces:
  - drop handlers for both subject and body inputs
  - insertion at active caret or fallback to end of field

- [ ] **Step 1: Write the failing tests**

Add tests that assert:

```tsx
fireEvent.dragStart(variableButton, { dataTransfer });
fireEvent.drop(screen.getByLabelText("Tiêu đề"), { dataTransfer });
expect(onChange).toHaveBeenCalledWith({ subject: "Cảm ơn [Tên khách hàng]" /* display layer before serialization assertion */ });
```

For final serialized output assertion:

```tsx
expect(onChange).toHaveBeenCalledWith({ subject: "Cảm ơn {{customerName}}" });
expect(onChange).toHaveBeenCalledWith({ html: "<p>{{orderCode}}</p>" });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest.cmd run src/modules/marketing/components/TemplateEditor.test.tsx --maxWorkers=1`

Expected: FAIL because drop handlers are missing.

- [ ] **Step 3: Write minimal implementation**

Implement:

- `onDragStart` from palette
- `onDragOver` prevent default on both editors
- `onDrop` read variable key and insert friendly token at caret/end
- serialize back to raw tokens through existing codec before calling `onChange`

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest.cmd run src/modules/marketing/components/TemplateEditor.test.tsx --maxWorkers=1`

Expected: PASS for drag-drop insertion into both fields.

- [ ] **Step 5: Commit**

```bash
git add src/modules/marketing/components/TemplateEditor.tsx src/modules/marketing/components/TemplateEditor.test.tsx
git commit -m "feat(marketing): support drag-drop variable insertion"
```

### Task 5: Verify preview compatibility and app integration

**Files:**
- Modify: `src/modules/marketing/components/TemplateEditor.tsx`
- Modify: `src/modules/marketing/components/TemplateEditor.test.tsx`
- Verify only: `src/modules/marketing/pages/MarketingAutomationSettingsPage.tsx`
- Verify only: `src/modules/marketing/components/HolidayCampaignsSection.tsx`

**Interfaces:**
- Consumes:
  - raw `subject` / `html` props from parent forms
- Produces:
  - unchanged parent API
  - preview rendering through raw-token serialization + `fillSampleValues(...)`

- [ ] **Step 1: Write the failing tests**

Add or update tests asserting:

```tsx
render(<TemplateEditor automationType="thank_you" subject="Cảm ơn {{customerName}}" html="<p>Đơn {{orderCode}}</p>" ... />);
fireEvent.click(screen.getByRole("button", { name: /Xem trước/i }));
expect(screen.getByText("Cảm ơn Chị Nguyễn Thu Lan")).toBeTruthy();
expect(screen.getByText("Đơn DH-2026-0158")).toBeTruthy();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest.cmd run src/modules/marketing/components/TemplateEditor.test.tsx --maxWorkers=1`

Expected: FAIL if preview consumes friendly display text instead of raw token text.

- [ ] **Step 3: Write minimal implementation**

Ensure preview always:

- serializes current friendly display values back to raw token text first
- then runs `fillSampleValues(...)`
- keeps parent `onChange` contract unchanged

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
./node_modules/.bin/vitest.cmd run src/modules/marketing/components/TemplateEditor.test.tsx --maxWorkers=1
npm run typecheck
```

Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/modules/marketing/components/TemplateEditor.tsx src/modules/marketing/components/TemplateEditor.test.tsx
git commit -m "fix(marketing): preserve preview with friendly variable editor"
```

### Task 6: Final regression verification

**Files:**
- Verify only: `src/modules/marketing/components/TemplateEditor.tsx`
- Verify only: `src/modules/marketing/components/TemplateEditor.test.tsx`
- Verify only: `src/modules/marketing/pages/MarketingAutomationSettingsPage.tsx`
- Verify only: `src/modules/marketing/components/HolidayCampaignsSection.tsx`

**Interfaces:**
- Consumes: completed editor implementation
- Produces: fresh verification evidence for implementation completion

- [ ] **Step 1: Run focused frontend tests**

Run:

```bash
./node_modules/.bin/vitest.cmd run src/modules/marketing/components/TemplateEditor.test.tsx --maxWorkers=1
```

Expected: PASS with all TemplateEditor tests green.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS with exit code 0.

- [ ] **Step 3: Smoke-check changed integration files**

Run:

```bash
git diff -- src/modules/marketing/components/TemplateEditor.tsx src/modules/marketing/components/TemplateEditor.test.tsx src/modules/marketing/pages/MarketingAutomationSettingsPage.tsx src/modules/marketing/components/HolidayCampaignsSection.tsx
```

Expected: Only intended marketing editor changes remain.

- [ ] **Step 4: Commit**

```bash
git add src/modules/marketing/components/TemplateEditor.tsx src/modules/marketing/components/TemplateEditor.test.tsx
git commit -m "test(marketing): verify drag-drop variable editor rollout"
```

## Self-Review

- Spec coverage: registry, friendly labels, click/drag insertion for both subject and body, raw-token storage, preview compatibility, template backward compatibility, and focused marketing-only rollout are all covered by Tasks 1-6.
- Placeholder scan: no `TODO`/`TBD`; each task names exact files, commands, and expected outcomes.
- Type consistency: all tasks consistently use `MarketingAutomationType`, `toFriendlyTokens`, `toRawTokens`, `MarketingVariablePalette`, and `TemplateEditor` raw `onChange` outputs.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-19-marketing-template-drag-drop-variables.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Because you explicitly asked to implement immediately, I will proceed with **Inline Execution** unless you want me to switch.
