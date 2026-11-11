import assert from "node:assert/strict";
import test from "node:test";
import { createPaymentSchema } from "./payment.validation";

const VALID_OBJECT_ID = "507f1f77bcf86cd799439011";

function validateDate(date: string) {
  return createPaymentSchema.validate({
    studentId: VALID_OBJECT_ID,
    studentName: "Nguyễn Văn A",
    amount: 1_500_000,
    date,
  });
}

test("chấp nhận hai định dạng ngày mà hệ thống quy đổi được sang paidOn", () => {
  assert.equal(validateDate("15/12/2025").error, undefined);
  assert.equal(validateDate("2025-12-15").error, undefined);
});

test("từ chối ngày sai định dạng để không sinh thêm dữ liệu không quy đổi được", () => {
  for (const date of ["1/2/2026", "20260102", "hôm nay", "15-12-2025"]) {
    const { error } = validateDate(date);
    assert.ok(error, `phải từ chối định dạng: ${date}`);
    assert.match(error.message, /DD\/MM\/YYYY/);
  }
});
