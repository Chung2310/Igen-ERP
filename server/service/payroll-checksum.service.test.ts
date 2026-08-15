import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { calculatePayrollChecksum, canonicalizePayrollSnapshot } from "./payroll-checksum.service";

describe("payroll checksum", () => {
  it("is stable when object keys are reordered", () => {
    expect(canonicalizePayrollSnapshot({ b: 2, a: 1 })).toBe(canonicalizePayrollSnapshot({ a: 1, b: 2 }));
    expect(calculatePayrollChecksum({ b: 2, a: 1 })).toBe(calculatePayrollChecksum({ a: 1, b: 2 }));
  });
  it("changes when a payroll amount changes", () => {
    expect(calculatePayrollChecksum({ employeeId: "e1", net: 100 })).not.toBe(calculatePayrollChecksum({ employeeId: "e1", net: 101 }));
  });
  it("treats mongoose ObjectId and its hex string representation identically", () => {
    const id = new mongoose.Types.ObjectId();
    const objWithObjectId = { id: id };
    const objWithStringId = { id: id.toHexString() };
    expect(calculatePayrollChecksum(objWithObjectId)).toBe(calculatePayrollChecksum(objWithStringId));
  });
});

