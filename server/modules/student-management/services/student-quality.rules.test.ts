import assert from "node:assert/strict";
import test from "node:test";
import { getQualityWarningLevel, toRate } from "./student-quality.rules";

test("toRate returns null without a denominator and rounds a valid rate", () => {
  assert.equal(toRate(2, 0), null);
  assert.equal(toRate(2, 3), 66.7);
});

test("quality warning gives priority to risk and handles unscored learners", () => {
  assert.equal(getQualityWarningLevel({ attendanceRate: null, assignmentRate: null, latestMiniTestRate: null }), "unrated");
  assert.equal(getQualityWarningLevel({ attendanceRate: 92, assignmentRate: 100, latestMiniTestRate: 49 }), "risk");
  assert.equal(getQualityWarningLevel({ attendanceRate: 78, assignmentRate: 100, latestMiniTestRate: null }), "watch");
  assert.equal(getQualityWarningLevel({ attendanceRate: 90, assignmentRate: 80, latestMiniTestRate: 70 }), "good");
  assert.equal(getQualityWarningLevel({ attendanceRate: null, assignmentRate: null, latestMiniTestRate: null, latestExamFailed: true }), "risk");
});
