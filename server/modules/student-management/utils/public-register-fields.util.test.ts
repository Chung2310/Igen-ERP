import assert from "node:assert/strict";
import { afterEach, it, vi } from "vitest";
import { StandardFieldConfig } from "../models/standard-field-config.model";
import {
  findMissingPublicRegisterFields,
  resolvePublicRegisterFields,
} from "./public-register-fields.util";

afterEach(() => vi.restoreAllMocks());

function mockOverrides(rows: Record<string, unknown>[]) {
  vi.spyOn(StandardFieldConfig, "find").mockReturnValue({
    lean: async () => rows,
  } as never);
}

it("applies the company's label and required flag onto the default fields", async () => {
  mockOverrides([
    { key: "email", label: "Email liên hệ", isRequired: true, isVisible: true, isArchived: false },
  ]);

  const fields = await resolvePublicRegisterFields("ACME");
  const email = fields.find((field) => field.key === "email");

  assert.equal(email?.label, "Email liên hệ");
  assert.equal(email?.isRequired, true);
  // Trường không được tùy biến vẫn giữ mặc định.
  assert.equal(fields.find((field) => field.key === "address")?.label, "Địa chỉ");
});

it("never marks a hidden or archived field as required", async () => {
  mockOverrides([
    { key: "idCard", label: "CCCD", isRequired: true, isVisible: false, isArchived: false },
    { key: "address", label: "Địa chỉ", isRequired: true, isVisible: true, isArchived: true },
  ]);

  const fields = await resolvePublicRegisterFields("ACME");

  assert.equal(fields.find((field) => field.key === "idCard")?.isRequired, false);
  assert.equal(fields.find((field) => field.key === "address")?.isRequired, false);
});

it("reports required fields left blank, using the configured labels", async () => {
  mockOverrides([
    { key: "email", label: "Email liên hệ", isRequired: true, isVisible: true, isArchived: false },
  ]);

  const missing = await findMissingPublicRegisterFields("ACME", {
    fullName: "Nguyen Van A",
    phone: "0901234567",
    email: "   ",
  });

  assert.deepEqual(missing, ["Email liên hệ"]);
});

it("keeps full name and phone required even when the company hides them", async () => {
  mockOverrides([
    { key: "fullName", label: "Họ và tên", isRequired: false, isVisible: false, isArchived: false },
    { key: "phone", label: "Số điện thoại", isRequired: false, isVisible: false, isArchived: false },
  ]);

  const missing = await findMissingPublicRegisterFields("ACME", {});

  assert.deepEqual(missing, ["Họ và tên", "Số điện thoại"]);
});

it("passes when every required field is filled in", async () => {
  mockOverrides([]);

  const missing = await findMissingPublicRegisterFields("ACME", {
    fullName: "Nguyen Van A",
    phone: "0901234567",
  });

  assert.deepEqual(missing, []);
});
