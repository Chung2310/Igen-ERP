import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { deserialize, serialize } from "bson";
import {
  calculatePayrollChecksum,
  canonicalizePayrollSnapshot,
  normalizePayrollSnapshotForPersistence,
} from "./payroll-checksum.service";

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

  it("normalizes runtime values to a non-mutating BSON-stable representation", () => {
    const id = new mongoose.Types.ObjectId();
    const input = {
      empty: {},
      customValues: new Map([["sales", 125]]),
      createdAt: new Date("2026-08-15T00:00:00.000Z"),
      id,
      omitted: undefined,
      values: [undefined, Number.NaN, Number.POSITIVE_INFINITY, 4],
    };

    const normalized = normalizePayrollSnapshotForPersistence(input);
    const stored = deserialize(serialize({ value: normalized })).value;

    expect(normalized).toEqual({
      empty: {},
      customValues: { sales: 125 },
      createdAt: "2026-08-15T00:00:00.000Z",
      id: id.toHexString(),
      values: [null, null, null, 4],
    });
    expect(input.customValues).toBeInstanceOf(Map);
    expect(calculatePayrollChecksum(stored)).toBe(calculatePayrollChecksum(normalized));
  });
});

