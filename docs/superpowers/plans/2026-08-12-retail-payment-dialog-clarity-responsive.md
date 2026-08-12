# Retail Payment Dialog Clarity and Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clarify every payment field, format money while typing in Vietnamese style, and eliminate horizontal overflow in the Retail payment dialog.

**Architecture:** Extract a focused `CurrencyInput` that converts between formatted digit strings and integer values. Integrate it into `ExplicitPaymentDialog`, add visible field semantics, and replace fixed-width grids with responsive min-width-safe layouts without changing payment payloads.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Testing Library, Vitest.

## Global Constraints

- Keep state and API payload monetary values as integers.
- Preserve all three payment modes and their current validation.
- Show visible labels and descriptions for debt date and cash fields.
- Prevent horizontal overflow at narrow viewport widths.

---

### Task 1: Vietnamese currency input

**Files:**
- Create: `src/modules/retail/components/pos/CurrencyInput.tsx`
- Create: `src/modules/retail/components/pos/CurrencyInput.test.tsx`

**Interfaces:**
- Produces: `CurrencyInput({ label, description?, value, onChange })`.
- `value` is an integer and `onChange` receives an integer.

- [ ] **Step 1: Write failing tests**

Test visible label/description, `500000` rendering as `500.000`, fixed `₫` suffix, `type="text"`, `inputMode="numeric"`, digit normalization for typed/pasted `1.234.567 ₫`, and empty input mapping to `0`.

- [ ] **Step 2: Verify RED**

Run `npx vitest run src/modules/retail/components/pos/CurrencyInput.test.tsx`; expect import failure because the component is absent.

- [ ] **Step 3: Implement CurrencyInput**

Render a labelled wrapper, description, relative input container and suffix. Format with `Intl.NumberFormat("vi-VN")`; normalize changes via `raw.replace(/\D/g, "")`; emit `Number(digits || 0)`.

- [ ] **Step 4: Verify GREEN**

Run the same test; expect all CurrencyInput tests to pass.

### Task 2: Field clarity and responsive payment blocks

**Files:**
- Modify: `src/modules/retail/components/pos/ExplicitPaymentDialog.tsx`
- Modify: `src/modules/retail/components/pos/PaymentDialog.test.tsx`

**Interfaces:**
- Consumes: `CurrencyInput` from Task 1.
- Preserves: `onSubmit(RetailPaymentInput[], dueDate?)` contract.

- [ ] **Step 1: Write failing dialog tests**

Assert visible `Nguồn tiền 1`, `Phương thức thanh toán`, `Số tiền thu`, its description, `Tiền khách đưa` and its description. Switch to transfer and assert `Mã giao dịch`. Assert debt date label/description. Enter formatted money and prove submit receives integer values. Assert dialog and field containers include `overflow-x-hidden`, `min-w-0`, and mobile-first responsive grid classes.

- [ ] **Step 2: Verify RED**

Run `npx vitest run src/modules/retail/components/pos/PaymentDialog.test.tsx`; expect failures for absent visible labels and raw number inputs.

- [ ] **Step 3: Implement labelled responsive layout**

Use `CurrencyInput` for collected/tendered values. Wrap each row as a source card with heading and labelled fields. Use one-column mobile layout and `lg:grid-cols-[minmax(0,...)...]`; add `w-full min-w-0`. Add the visible debt-date label and description. Change summary to `grid-cols-1 sm:grid-cols-3`, and add word-safe metric styles.

- [ ] **Step 4: Verify GREEN**

Run CurrencyInput and PaymentDialog tests; expect all to pass with unchanged integer payload assertions.

### Task 3: Regression verification

**Files:**
- Test only: existing Retail payment and POS tests.

- [ ] **Step 1: Run focused regression**

Run CurrencyInput, PaymentDialog, retailPayment and RetailPosPage tests; expect zero failures.

- [ ] **Step 2: Run static and production checks**

Run `npm run typecheck` and `npm run build`; expect exit code 0.

- [ ] **Step 3: Review and commit**

Run `git diff --check`, inspect the scoped Retail diff, and commit with `fix: clarify and contain retail payment dialog`.
