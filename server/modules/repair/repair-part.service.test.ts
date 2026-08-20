import { expect, test } from "vitest";
import { defaultPartBilling } from "./repair-part.service";
import { RepairPartModel } from "./repair-part.model";

test("diện bảo hành quyết định ai trả tiền linh kiện", () => {
  expect(defaultPartBilling("supplier")).toBe("warranty_supplier");
  expect(defaultPartBilling("shop")).toBe("warranty_shop");
  expect(defaultPartBilling("customer")).toBe("customer");
  expect(defaultPartBilling(undefined)).toBe("customer");
});

test("linh kiện lưu được diện chi phí và cờ tính tiền", () => {
  expect(RepairPartModel.schema.path("billing")).toBeTruthy();
  expect(RepairPartModel.schema.path("chargeable")).toBeTruthy();
});
