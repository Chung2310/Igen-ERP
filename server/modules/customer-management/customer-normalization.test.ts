import assert from "node:assert/strict";
import test from "node:test";
import { formatCustomerCode, normalizeCustomerInput, normalizePhone, phoneLookupVariants } from "./customer-normalization";

test('customer kind is independent of VAT and keeps business contact information', () => {
  const business = normalizeCustomerInput({ name: 'Doanh nghiệp', phone: '0901000001', customerKind: 'business', contactName: '  Người liên hệ  ', type: 'regular' });
  assert.equal(business.customerKind, 'business'); assert.equal(business.contactName, 'Người liên hệ'); assert.equal(business.type, 'regular');
  assert.equal(normalizeCustomerInput({ name: 'Cá nhân', phone: '0901000002', customerKind: 'individual', type: 'vat' }).customerKind, 'individual');
  assert.throws(() => normalizeCustomerInput({ name: 'A', phone: '0901', customerKind: 'vat' }), /cá nhân hoặc doanh nghiệp/);
});

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
    normalizedPhone: "0901234567",
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
  assert.equal(normalizePhone("(+84) 901.234.567"), "0901234567");
  assert.equal(normalizePhone("+84 (0) 901.234.567"), "0901234567");
  assert.deepEqual(phoneLookupVariants("0901234567"), ["0901234567", "84901234567"]);
  assert.equal(formatCustomerCode(" igen ", 12), "KH-IGEN-000012");
});

test("keeps extra customer facts in notes alongside explicitly supplied notes", () => {
  const customer = normalizeCustomerInput({
    name: "An", phone: "0901234567", notes: "Khách thân thiết",
    "Ngân sách": "50 triệu", "Giờ liên hệ": "Buổi chiều",
    "Số lần mua": 0, "Cần giao hàng": false, "Yêu cầu": { color: "trắng" },
    empty: "  ", missing: null,
  });
  assert.equal(customer.notes, 'Khách thân thiết\nNgân sách: 50 triệu\nGiờ liên hệ: Buổi chiều\nSố lần mua: 0\nCần giao hàng: false\nYêu cầu: {"color":"trắng"}');
  assert.equal((customer as any)["Ngân sách"], undefined);
});

test("does not turn customer metadata or credentials into notes", () => {
  const customer = normalizeCustomerInput({
    name: "An", phone: "0901234567", _id: "internal", companyCode: "OTHER", branchId: "BRANCH",
    customerCode: "KH-001", version: 8, createdBy: "ADMIN", createdAt: new Date(),
    tier: { code: "VIP" }, pointsBalance: 100, avatarUrl: "https://example.com/avatar",
    password: "private", accessToken: "private", $set: { name: "Other" },
  });
  assert.equal(customer.notes, undefined);
});

test("does not duplicate extra facts when the same input is normalized again", () => {
  const customer = normalizeCustomerInput({ name: "An", phone: "0901234567", notes: "Ngân sách: 50 triệu", "Ngân sách": "50 triệu" });
  assert.equal(customer.notes, "Ngân sách: 50 triệu");
});
