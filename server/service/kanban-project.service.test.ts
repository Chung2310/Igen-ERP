import assert from "node:assert/strict";
import test from "node:test";
import { calculateProjectProgress, deriveProjectLifecycle, newUploadAttachments, validateProjectPayload } from "./kanban-project.service";

test("calculates completed tasks and excludes archived tasks", () => {
  assert.deepEqual(calculateProjectProgress([
    { status: "Done" }, { status: "done" }, { status: "In Progress" }, { status: "Archived" },
  ]), { completed: 2, total: 3, percent: 67 });
});

test("returns zero progress for a project without eligible tasks", () => {
  assert.deepEqual(calculateProjectProgress([{ status: "Archived" }]), { completed: 0, total: 0, percent: 0 });
});

test("automatically completes and reopens projects but preserves manual overrides", () => {
  const now = new Date("2026-08-13T10:00:00.000Z");
  assert.deepEqual(deriveProjectLifecycle("in_progress", { completed: 2, total: 2, percent: 100 }, now), {
    status: "completed", completedAt: now,
  });
  assert.deepEqual(deriveProjectLifecycle("completed", { completed: 1, total: 2, percent: 50 }, now), {
    status: "in_progress", completedAt: null,
  });
  assert.equal(deriveProjectLifecycle("paused", { completed: 2, total: 2, percent: 100 }, now), null);
  assert.equal(deriveProjectLifecycle("in_progress", { completed: 0, total: 0, percent: 0 }, now), null);
  assert.deepEqual(deriveProjectLifecycle("completed", { completed: 0, total: 0, percent: 0 }, now), { status: "in_progress", completedAt: null });
});

test("validates status, priority, dates, and attachment links", () => {
  assert.throws(() => validateProjectPayload({ status: "wrong" }), /Trạng thái/);
  assert.throws(() => validateProjectPayload({ priority: "wrong" }), /Độ ưu tiên/);
  assert.throws(() => validateProjectPayload({ startAt: "not-a-date" }), /Thời gian bắt đầu/);
  assert.throws(() => validateProjectPayload({ startAt: "2026-08-14", dueAt: "2026-08-13" }), /Hạn cuối/);
  assert.throws(() => validateProjectPayload({ attachments: [{ id: "1", name: "x", type: "link", url: "javascript:x" }] }), /liên kết/);
  assert.throws(() => validateProjectPayload({ attachments: [{ id: "1", name: "x", type: "file", url: "javascript:x" }] }), /liên kết/);
});

test("rejects manually completing a project without complete tasks", () => {
  assert.throws(() => validateProjectPayload({ status: "completed" }, { completed: 0, total: 0, percent: 0 }), /chưa hoàn thành/);
  assert.doesNotThrow(() => validateProjectPayload({ status: "completed" }, { completed: 2, total: 2, percent: 100 }));
});

test("finalizes only upload tokens newly added by an editor", () => {
  const existing = [{ id: "old", uploadToken: "token-old" }];
  const next = [{ id: "old", uploadToken: "token-old" }, { id: "new", uploadToken: "token-new" }];
  assert.deepEqual(newUploadAttachments(next, existing), [{ id: "new", uploadToken: "token-new" }]);
});
