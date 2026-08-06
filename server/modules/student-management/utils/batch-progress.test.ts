import assert from "node:assert/strict";
import { it } from "vitest";
import { computeBatchProgress } from "./batch-progress.util";

// Lớp T2/T4/T6, chạy 2026-08-03 → 2026-08-14 (6 buổi)
const base = {
  startDate: "2026-08-03",
  endDate: "2026-08-14",
  daysOfWeek: [1, 3, 5],
};

const at = (today: string) => ({ today });

it("shows green before 80% of sessions have been completed", () => {
  // 2026-08-05: còn buổi hôm nay + 4 buổi = 5
  const result = computeBatchProgress({ ...base, status: "Đang học" }, at("2026-08-05"));
  assert.equal(result.progressLevel, "green");
  assert.equal(result.remainingSessions, 5);
  assert.equal(result.totalSessions, 6);
  assert.equal(result.doneSessions, 1);
});

it("switches to yellow once 80% of sessions have been completed", () => {
  const result = computeBatchProgress({ ...base, status: "Đang học" }, at("2026-08-13"));
  assert.equal(result.progressLevel, "yellow");
  assert.equal(result.doneSessions, 5);
});

it("shows red when the end date has passed but the class is still open", () => {
  const result = computeBatchProgress({ ...base, status: "Đang học" }, at("2026-08-20"));
  assert.equal(result.progressLevel, "red");
  assert.equal(result.remainingSessions, 0);
});

it("prefers red over yellow — an overdue class is not merely low on sessions", () => {
  const result = computeBatchProgress({ ...base, status: "Sắp khai giảng" }, at("2026-08-20"));
  assert.equal(result.progressLevel, "red");
});

it("greys out a class that has not opened yet", () => {
  const result = computeBatchProgress({ ...base, status: "Sắp khai giảng" }, at("2026-08-05"));
  assert.equal(result.progressLevel, "grey");
});

it("greys out a finished class and adds no age label while it is recent", () => {
  const result = computeBatchProgress(
    { ...base, status: "Đã kết thúc", completedAt: "2026-08-15" },
    at("2026-09-01")
  );
  assert.equal(result.progressLevel, "grey");
  assert.equal(result.ageLabel, null);
});

it("shows a class finished between six months and a year in black", () => {
  const result = computeBatchProgress(
    { ...base, status: "Đã kết thúc", completedAt: "2026-01-10" },
    at("2026-09-01")
  );
  assert.equal(result.progressLevel, "black");
  assert.equal(result.ageLabel, null);
});

it("shows a class finished exactly six calendar months ago in black", () => {
  const result = computeBatchProgress(
    { ...base, status: "Đã kết thúc", completedAt: "2026-02-28" },
    at("2026-08-28")
  );
  assert.equal(result.progressLevel, "black");
});

it("labels a class finished over a year ago red", () => {
  const result = computeBatchProgress(
    { ...base, status: "Đã kết thúc", completedAt: "2025-01-10" },
    at("2026-09-01")
  );
  assert.equal(result.ageLabel, "red");
});

it("falls back to updatedAt for old classes that never recorded completedAt", () => {
  const result = computeBatchProgress(
    { ...base, status: "Đã kết thúc", completedAt: null, updatedAt: "2025-01-10" },
    at("2026-09-01")
  );
  assert.equal(result.ageLabel, "red");
});

it("gives a cancelled class no age label — the label is for completed classes only", () => {
  const result = computeBatchProgress(
    { ...base, status: "Đã hủy", cancelledAt: "2025-01-10" } as never,
    at("2026-09-01")
  );
  assert.equal(result.progressLevel, "grey");
  assert.equal(result.ageLabel, null);
});

it("excludes holidays from the session counts behind the warning", () => {
  // 2026-08-07 là buổi học; cho nghỉ lễ thì còn 3 buổi thay vì 4
  const result = computeBatchProgress(
    { ...base, status: "Đang học" },
    { today: "2026-08-07", holidaySet: new Set(["2026-08-07"]) }
  );
  assert.equal(result.remainingSessions, 3);
  assert.equal(result.totalSessions, 5);
  assert.equal(result.progressLevel, "green");
});
