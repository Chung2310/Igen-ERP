import assert from "node:assert/strict";
import { it } from "vitest";
import { transitionEnrollmentStatus } from "./enrollment-status.util";

const enrolled = {
  status: "Đang học" as const,
  allowedSessions: 12,
  attendedSessions: 5,
  suspendedAt: null,
  suspensionReason: "",
  expectedReturnAt: null,
};

it("suspends an enrollment without changing its session counts", () => {
  const result = transitionEnrollmentStatus(enrolled, "Bảo lưu", {
    now: new Date("2026-08-05T00:00:00.000Z"),
    reason: "Đi công tác",
    expectedReturnAt: "2026-09-01",
  });
  assert.equal(result.status, "Bảo lưu");
  assert.equal(result.allowedSessions, 12);
  assert.equal(result.attendedSessions, 5);
  assert.equal(result.suspensionReason, "Đi công tác");
});

it("resumes an enrollment without changing its session counts", () => {
  const result = transitionEnrollmentStatus(
    { ...enrolled, status: "Bảo lưu", suspendedAt: new Date("2026-08-01T00:00:00.000Z"), suspensionReason: "Đi công tác", expectedReturnAt: "2026-09-01" },
    "Đang học",
    { now: new Date("2026-08-05T00:00:00.000Z") },
  );
  assert.deepEqual(result, {
    ...enrolled,
    status: "Đang học" as const,
    suspendedAt: null,
    suspensionReason: "",
    expectedReturnAt: null,
  });
});