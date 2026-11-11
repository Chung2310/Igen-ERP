import { it as test, afterEach } from "vitest";
import assert from "node:assert/strict";
import { aiProgress, aiRequestDescription, createAiProgressStore, exportTaskDescription } from "./ai-progress";
afterEach(() => aiProgress.reset());
test("all AI request families have popup labels while ordinary edits and reads do not", () => {
  for (const [url, method, data] of [
    ["/api/quote-requests/request/analyze", "POST", {}],
    ["/api/customer-quotes/suggest", "POST", {}],
    ["/api/budget-plans/suggest", "POST", {}],
    ["/api/budget-plans/plan", "PATCH", { action: "answer" }],
    ["/api/budget-plans/plan", "PATCH", { action: "recalculate" }],
    ["/api/quotes/quote", "PATCH", { recalculateWithAi: true }],
    ["/api/quotes/from-customer", "POST", {}],
    ["/api/customer-quotes", "POST", {}],
    ["/api/quotes/quote/export/retry", "POST", {}],
    ["/api/quotes/quote/export?draft=1&background=1", "GET", {}],
    ["/api/contracts/contract/file?background=1", "GET", {}],
    ["/api/acceptance-records/record/file?background=1", "GET", {}],
    ["/api/acceptance-records/record/settlement/file?background=1", "GET", {}],
    ["/api/acceptance-records/record/settlement.xlsx", "GET", {}],
    ["/api/budget-plans/plan/export?background=1", "GET", {}],
    ["/api/price-list", "POST", {}],
  ] as const) {
    const description = aiRequestDescription(url, method, JSON.stringify(data));
    assert.ok(description, `${method} ${url}`);
    assert.doesNotMatch(description.label, /\/api\/|openrouter|binding/i);
  }
  for (const [url, method, data] of [
    ["/api/catalog", "GET", {}], ["/api/quotes/quote", "PATCH", {}],
    ["/api/budget-plans/plan", "PATCH", { action: "quantity" }],
    ["/api/auth/login", "POST", {}], ["/api/export-jobs/job", "GET", {}],
  ] as const) assert.equal(aiRequestDescription(url, method, JSON.stringify(data)), null);
  assert.equal(aiRequestDescription("/api/quotes/quote", "PATCH", "null"), null);
});

test("export labels and identities distinguish each document type and its source", () => {
  assert.equal(exportTaskDescription("/api/quotes/a/export?draft=1").key, "export:estimate_draft:a");
  assert.equal(exportTaskDescription("/api/quotes/a/export").key, "export:estimate:a");
  assert.equal(exportTaskDescription("/api/contracts/b/file").key, "export:contract:b");
  assert.equal(exportTaskDescription("/api/acceptance-records/c/file").key, "export:acceptance:c");
  assert.equal(exportTaskDescription("/api/acceptance-records/c/settlement/file").key, "export:settlement:c");
  assert.equal(exportTaskDescription("/api/budget-plans/d/export").key, "export:budget:d");
});

test("estimated progress is monotonic, remains below 100 during long waits and finishes only on success", () => {
  let now = 0;
  const timers: Array<() => void> = [];
  const store = createAiProgressStore({ now: () => now, schedule: (callback) => { timers.push(callback); return () => {}; } });
  const task = store.begin({ label: "Đang tính" });
  assert.equal(store.getSnapshot()[0].progress, 3);
  now = 45_000; store.tick();
  const halfway = store.getSnapshot()[0].progress;
  assert.ok(halfway > 30 && halfway < 94);
  task.update(12, "Đang xử lý");
  assert.ok(store.getSnapshot()[0].progress >= halfway);
  now = 3_600_000; store.tick();
  assert.equal(store.getSnapshot()[0].progress, 94);
  store.dismiss(store.getSnapshot()[0].id);
  assert.equal(store.getSnapshot().length, 1);
  task.complete();
  assert.equal(store.getSnapshot()[0].progress, 100);
  assert.equal(store.getSnapshot()[0].status, "completed");
  timers[0]();
  assert.equal(store.getSnapshot().length, 0);
});

test("repeated job polls do not restart the progress clock or create duplicate tasks", () => {
  let now = 0;
  const store = createAiProgressStore({ now: () => now });
  const first = store.begin({ key: "export:one", label: "Đang tạo file" });
  first.update(30, "Đang xử lý");
  now = 30_000; store.tick();
  const before = store.getSnapshot()[0];
  store.begin({ key: "export:one", label: "Đang tạo file" }).update(30, "Đang xử lý");
  assert.equal(store.getSnapshot().length, 1);
  assert.equal(store.getSnapshot()[0].stageStartedAt, 0);
  now = 60_000; store.tick();
  assert.ok(store.getSnapshot()[0].progress > before.progress);
  store.reset();
});
test("one completed concurrent task does not dismiss other work and failures never become 100%", () => {
  const store = createAiProgressStore({ schedule: () => () => {} });
  const first = store.begin({ label: "Một" });
  const second = store.begin({ label: "Hai" });
  first.complete();
  assert.equal(store.getSnapshot().filter((task) => task.status === "running").length, 1);
  second.fail(new Error("OpenRouter HTTP 402: insufficient credits"));
  const failure = store.getSnapshot().find((task) => task.status === "failed")!;
  assert.ok(failure.progress < 100);
  assert.doesNotMatch(failure.detail, /OpenRouter|402|credits/);
  store.dismiss(failure.id);
  assert.ok(!store.getSnapshot().some((task) => task.status === "failed"));
  store.reset();
});
