import assert from "node:assert/strict";
import test from "node:test";
import { formatCustomerCode, normalizeCustomerInput, normalizePhone } from "./customer-normalization";

test("normalizes a company-wide customer identity", () => {
  assert.deepEqual(normalizeCustomerInput({
    name: "  Nguyễn Văn A ",
    phone: "+84 901-234-567",
    email: " A@EXAMPLE.COM ",
    type: "regular",
    gender: "male",
    dateOfBirth: "1990-02-03",
  }), {
    name: "Nguyễn Văn A",
    phone: "+84 901-234-567",
    normalizedPhone: "84901234567",
    email: "a@example.com",
    type: "regular",
    gender: "male",
    dateOfBirth: new Date("1990-02-03T00:00:00.000Z"),
    status: "active",
  });
});

test("normalizes optional profile fields", () => {
  assert.deepEqual(normalizeCustomerInput({
    name: "An",
    phone: "0901 000 001",
    address: "  1 Nguyễn Huệ ",
    notes: "  Khách thân thiết ",
    source: "import",
  }), {
    name: "An",
    phone: "0901 000 001",
    normalizedPhone: "0901000001",
    address: "1 Nguyễn Huệ",
    notes: "Khách thân thiết",
    type: "regular",
    status: "active",
    source: "import",
  });
});

test("requires both name and phone", () => {
  assert.throws(() => normalizeCustomerInput({ name: "", phone: "0901" }), /Tên khách hàng là bắt buộc/);
  assert.throws(() => normalizeCustomerInput({ name: "An", phone: "" }), /Số điện thoại là bắt buộc/);
});

test("rejects invalid enum and calendar date values", () => {
  assert.throws(() => normalizeCustomerInput({ name: "An", phone: "0901", type: "business" }), /Loại khách hàng không hợp lệ/);
  assert.throws(() => normalizeCustomerInput({ name: "An", phone: "0901", gender: "unknown" }), /Giới tính không hợp lệ/);
  assert.throws(() => normalizeCustomerInput({ name: "An", phone: "0901", dateOfBirth: "2025-02-30" }), /Ngày sinh không hợp lệ/);
});

test("normalizes phone and formats a permanent customer code", () => {
  assert.equal(normalizePhone("(+84) 901.234.567"), "84901234567");
  assert.equal(formatCustomerCode(" igen ", 12), "KH-IGEN-000012");
});
