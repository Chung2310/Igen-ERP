import { describe, expect, it } from "vitest";
import {
  buildSettlementLines,
  confirmedPaidByEmployee,
  deriveRunSettlementStatus,
  validatePaymentRequest,
  validatePaymentTransition,
} from "./payroll-payment.service";

const revisionLines = [
  { employeeId: "emp-1", calculation: { net: 10_000_000 } },
  { employeeId: "emp-2", calculation: { net: 6_000_000 } },
];
const closedRun = { status: "closed" };

describe("confirmedPaidByEmployee", () => {
  it("counts only confirmed payments so cancelled and reversed money returns to the balance", () => {
    const paid = confirmedPaidByEmployee([
      { status: "confirmed", lines: [{ employeeId: "emp-1", amount: 4_000_000 }] },
      { status: "confirmed", lines: [{ employeeId: "emp-1", amount: 1_000_000 }, { employeeId: "emp-2", amount: 2_000_000 }] },
      { status: "cancelled", lines: [{ employeeId: "emp-1", amount: 9_000_000 }] },
      { status: "reversed", lines: [{ employeeId: "emp-2", amount: 9_000_000 }] },
      { status: "draft", lines: [{ employeeId: "emp-2", amount: 9_000_000 }] },
    ]);

    expect(paid.get("emp-1")).toBe(5_000_000);
    expect(paid.get("emp-2")).toBe(2_000_000);
  });
});

describe("deriveRunSettlementStatus", () => {
  it("keeps partial payments closed and reports paid only at full settlement", () => {
    const lines = (paid1: number, paid2: number) => buildSettlementLines(revisionLines, new Map([["emp-1", paid1], ["emp-2", paid2]]));

    expect(deriveRunSettlementStatus(lines(0, 0))).toBe("closed");
    expect(deriveRunSettlementStatus(lines(10_000_000, 0))).toBe("closed");
    expect(deriveRunSettlementStatus(lines(10_000_000, 6_000_000))).toBe("paid");
  });
});

describe("validatePaymentRequest", () => {
  const settlement = buildSettlementLines(revisionLines, new Map([["emp-1", 4_000_000]]));

  it("accepts a payment within the remaining balance of every employee", () => {
    expect(validatePaymentRequest(closedRun, settlement, {
      amount: 12_000_000,
      lines: [{ employeeId: "emp-1", amount: 6_000_000 }, { employeeId: "emp-2", amount: 6_000_000 }],
    })).toBeNull();
  });

  it("refuses to pay more than an employee still has outstanding", () => {
    expect(validatePaymentRequest(closedRun, settlement, {
      amount: 6_000_001,
      lines: [{ employeeId: "emp-1", amount: 6_000_001 }],
    })).toEqual(expect.objectContaining({ code: "PAYROLL_PAYMENT_EXCEEDS_NET", status: 409 }));
  });

  it("sums repeated employee lines before checking the balance", () => {
    expect(validatePaymentRequest(closedRun, settlement, {
      amount: 6_000_002,
      lines: [{ employeeId: "emp-1", amount: 6_000_000 }, { employeeId: "emp-1", amount: 2 }],
    })).toEqual(expect.objectContaining({ code: "PAYROLL_PAYMENT_EXCEEDS_NET" }));
  });

  it("requires the allocation to add up to the requested amount", () => {
    expect(validatePaymentRequest(closedRun, settlement, {
      amount: 5_000_000,
      lines: [{ employeeId: "emp-1", amount: 1_000_000 }],
    })).toEqual(expect.objectContaining({ code: "PAYROLL_PAYMENT_ALLOCATION_MISMATCH", status: 400 }));
  });

  it("rejects non-positive and fractional amounts", () => {
    for (const amount of [0, -1, 1.5]) {
      expect(validatePaymentRequest(closedRun, settlement, { amount, lines: [{ employeeId: "emp-1", amount }] })?.code)
        .toBe("PAYROLL_PAYMENT_INVALID_AMOUNT");
    }
  });

  it("rejects an employee who is not part of the run", () => {
    expect(validatePaymentRequest(closedRun, settlement, {
      amount: 1_000, lines: [{ employeeId: "ghost", amount: 1_000 }],
    })).toEqual(expect.objectContaining({ code: "PAYROLL_PAYMENT_UNKNOWN_EMPLOYEE" }));
  });

  it.each(["draft", "review", "paid"])("refuses to pay a run in status %s", (status) => {
    expect(validatePaymentRequest({ status }, settlement, {
      amount: 1_000, lines: [{ employeeId: "emp-1", amount: 1_000 }],
    })).toEqual(expect.objectContaining({ code: "PAYROLL_RUN_NOT_PAYABLE", status: 409 }));
  });

});

describe("validatePaymentTransition", () => {
  it("allows only the transitions the payment lifecycle defines", () => {
    expect(validatePaymentTransition({ status: "draft" }, "confirm")).toBeNull();
    expect(validatePaymentTransition({ status: "draft" }, "cancel")).toBeNull();
    expect(validatePaymentTransition({ status: "confirmed" }, "reverse")).toBeNull();

    expect(validatePaymentTransition({ status: "confirmed" }, "confirm")?.code).toBe("PAYROLL_PAYMENT_INVALID_TRANSITION");
    expect(validatePaymentTransition({ status: "cancelled" }, "confirm")?.code).toBe("PAYROLL_PAYMENT_INVALID_TRANSITION");
    expect(validatePaymentTransition({ status: "reversed" }, "reverse")?.code).toBe("PAYROLL_PAYMENT_INVALID_TRANSITION");
    expect(validatePaymentTransition({ status: "draft" }, "reverse")?.code).toBe("PAYROLL_PAYMENT_INVALID_TRANSITION");
  });

  it("reports a missing payment as not found", () => {
    expect(validatePaymentTransition(null, "confirm")).toEqual(expect.objectContaining({ code: "PAYROLL_PAYMENT_NOT_FOUND", status: 404 }));
  });
});
