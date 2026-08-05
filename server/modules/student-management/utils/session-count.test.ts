import assert from "node:assert/strict";
import { it } from "vitest";
import { countConsumedSessions, countRemainingSessions, countTotalSessions, listScheduledSessionDates } from "./session-count.util";

// 2026-08-03 là thứ Hai. Lớp T2/T4/T6 trong 2 tuần = 6 buổi.
const MON = "2026-08-03";
const TWO_WEEKS_END = "2026-08-14";
const MWF = [1, 3, 5];

it("counts sessions from the weekly schedule inside the date range", () => {
  assert.deepEqual(listScheduledSessionDates(MON, TWO_WEEKS_END, MWF), [
    "2026-08-03", "2026-08-05", "2026-08-07",
    "2026-08-10", "2026-08-12", "2026-08-14",
  ]);
});

it("drops a holiday that falls on a scheduled weekday", () => {
  // 2026-08-05 là thứ Tư, trùng một buổi học
  const holidays = new Set(["2026-08-05"]);
  assert.equal(countTotalSessions(MON, TWO_WEEKS_END, MWF, holidays), 5);
  assert.ok(!listScheduledSessionDates(MON, TWO_WEEKS_END, MWF, holidays).includes("2026-08-05"));
});

it("ignores holidays that do not land on a class day", () => {
  // 2026-08-04 là thứ Ba, lớp không học ngày này
  assert.equal(countTotalSessions(MON, TWO_WEEKS_END, MWF, new Set(["2026-08-04"])), 6);
});

it("counts Sunday classes — company working days must not filter them out", () => {
  // Chủ nhật = 0. Trung tâm ngoại ngữ dạy cuối tuần rất phổ biến.
  assert.deepEqual(listScheduledSessionDates(MON, TWO_WEEKS_END, [0]), ["2026-08-09"]);
});

it("counts remaining sessions from today inclusive", () => {
  // Hôm nay là 2026-08-07 (thứ Sáu, có lịch học) ⇒ còn buổi hôm nay + 3 buổi tuần sau
  assert.equal(countRemainingSessions("2026-08-07", TWO_WEEKS_END, MON, MWF), 4);
});

it("returns zero remaining once the class is past its end date", () => {
  assert.equal(countRemainingSessions("2026-08-20", TWO_WEEKS_END, MON, MWF), 0);
});

it("counts the whole schedule when today is before the start date", () => {
  assert.equal(countRemainingSessions("2026-07-01", TWO_WEEKS_END, MON, MWF), 6);
});

it("returns nothing for malformed or inverted date ranges", () => {
  assert.deepEqual(listScheduledSessionDates("", TWO_WEEKS_END, MWF), []);
  assert.deepEqual(listScheduledSessionDates(TWO_WEEKS_END, MON, MWF), []);
  assert.deepEqual(listScheduledSessionDates(MON, TWO_WEEKS_END, []), []);
});

it("counts a learner once per session even when the record is duplicated", () => {
  const sessions = [{ records: [{ studentId: "student-1", status: "present" }, { studentId: "student-1", status: "late" }] }];
  assert.equal(countConsumedSessions(sessions, "student-1"), 1);
});
