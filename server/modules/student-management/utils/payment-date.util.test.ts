import assert from "node:assert/strict";
import test from "node:test";
import { parsePaymentDate, PAYMENT_DATE_PATTERN } from "./payment-date.util";

test("đọc được định dạng DD/MM/YYYY mà frontend đang ghi", () => {
  const parsed = parsePaymentDate("15/12/2025");

  assert.ok(parsed);
  assert.equal(parsed.getUTCFullYear(), 2025);
  assert.equal(parsed.getUTCMonth(), 11);
  assert.equal(parsed.getUTCDate(), 15);
});

test("đọc được định dạng YYYY-MM-DD của dữ liệu import cũ", () => {
  const parsed = parsePaymentDate("2025-12-15");

  assert.ok(parsed);
  assert.equal(parsed.getUTCFullYear(), 2025);
  assert.equal(parsed.getUTCMonth(), 11);
  assert.equal(parsed.getUTCDate(), 15);
});

test("hai định dạng cùng một ngày cho ra đúng một mốc thời gian", () => {
  const slash = parsePaymentDate("02/01/2026");
  const dash = parsePaymentDate("2026-01-02");

  assert.ok(slash && dash);
  assert.equal(slash.getTime(), dash.getTime());
});

test("sắp xếp theo Date đúng thứ tự — thứ mà so sánh chuỗi DD/MM/YYYY làm sai", () => {
  const earlier = parsePaymentDate("15/12/2025");
  const later = parsePaymentDate("02/01/2026");

  assert.ok(earlier && later);
  // So chuỗi thì "02/01/2026" < "15/12/2025" (sai). Theo Date phải ngược lại.
  assert.ok(earlier.getTime() < later.getTime());
});

test("từ chối ngày không tồn tại thay vì âm thầm quy đổi sang tháng sau", () => {
  assert.equal(parsePaymentDate("31/02/2026"), null);
  assert.equal(parsePaymentDate("2026-02-31"), null);
});

test("từ chối chuỗi rác và giá trị rỗng", () => {
  for (const value of ["", "   ", "hôm nay", "1/2/2026", "20260102", null, undefined, 12345]) {
    assert.equal(parsePaymentDate(value as unknown), null, `phải từ chối: ${String(value)}`);
  }
});

test("giữ nguyên Date hợp lệ và loại Date lỗi", () => {
  const now = new Date();
  assert.equal(parsePaymentDate(now)?.getTime(), now.getTime());
  assert.equal(parsePaymentDate(new Date("không phải ngày")), null);
});

test("PAYMENT_DATE_PATTERN khớp đúng hai định dạng được chấp nhận", () => {
  assert.ok(PAYMENT_DATE_PATTERN.test("15/12/2025"));
  assert.ok(PAYMENT_DATE_PATTERN.test("2025-12-15"));
  assert.ok(!PAYMENT_DATE_PATTERN.test("1/2/2026"));
  assert.ok(!PAYMENT_DATE_PATTERN.test("hôm nay"));
});
