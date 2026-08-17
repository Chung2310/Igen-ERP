import { describe, expect, it } from "vitest";
import { assertCountTransition, assertEditableStatus, calculateQuantityDelta } from "./inventory-count.rules";

describe("inventory count rules", () => {
  it("calculates positive, negative, and zero deltas", () => {
    expect(calculateQuantityDelta(5, 8)).toBe(3);
    expect(calculateQuantityDelta(8, 5)).toBe(-3);
    expect(calculateQuantityDelta(5, 5)).toBe(0);
  });

  it("rejects negative counted quantities", () => {
    expect(() => calculateQuantityDelta(5, -1)).toThrow("Số lượng kiểm kê");
  });

  it("allows only the declared status transitions", () => {
    expect(() => assertCountTransition("draft", "counting")).not.toThrow();
    expect(() => assertCountTransition("completed", "draft")).toThrow();
    expect(() => assertEditableStatus("pending_approval")).toThrow();
  });
});
