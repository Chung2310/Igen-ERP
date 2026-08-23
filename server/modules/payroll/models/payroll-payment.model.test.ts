import { describe, expect, it } from "vitest";
import { PayrollPaymentModel } from "./payroll-payment.model";

describe("PayrollPaymentModel", () => {
  it("defines payment lifecycle and unique scoped idempotency", () => {
    expect(PayrollPaymentModel.schema.path("status").options.enum).toEqual(["draft", "confirmed", "cancelled", "reversed"]);
    expect(PayrollPaymentModel.schema.path("idempotencyKey")).toBeDefined();
    expect(PayrollPaymentModel.schema.indexes()).toEqual(expect.arrayContaining([
      [{ companyCode: 1, branchId: 1, idempotencyKey: 1 }, { unique: true }],
    ]));
  });
});
