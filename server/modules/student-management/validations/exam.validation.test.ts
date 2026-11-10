import { describe, expect, it } from "vitest";
import { gradeExamSchema } from "./exam.validation";

describe("gradeExamSchema", () => {
  it("rejects duplicate students in one grading request", () => {
    const result = gradeExamSchema.validate({ results: [
      { studentId: "507f1f77bcf86cd799439011", score: 80 },
      { studentId: "507f1f77bcf86cd799439011", score: 70 },
    ] });

    expect(result.error?.message).toMatch(/duplicate value|duplicate/i);
  });

  it("accepts distinct students and defaults omitted notes", () => {
    const result = gradeExamSchema.validate({ results: [
      { studentId: "507f1f77bcf86cd799439011", score: 80 },
      { studentId: "507f1f77bcf86cd799439012", score: 70, note: "Hoàn thành" },
    ] });

    expect(result.error).toBeUndefined();
    expect(result.value.results[0].note).toBe("");
  });
});
