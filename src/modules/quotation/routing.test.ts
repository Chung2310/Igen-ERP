import { describe, expect, it } from "vitest";
import { quotationRoute, quotationUrl } from "./routing";

describe("quotation route without an internal overview", () => {
  it("opens estimates from the module entry and the former overview URL", () => {
    expect(quotationRoute("/bao-gia", "").section).toBe("quotes");
    expect(quotationRoute("/bao-gia", "?sub=tong-quan").section).toBe("quotes");
    expect(quotationUrl("quotes")).toBe("/bao-gia?sub=du-toan");
  });

  it("keeps other quotation sections available", () => {
    expect(quotationRoute("/bao-gia", "?sub=bao-gia-khach").section).toBe("customerQuotes");
    expect(quotationRoute("/bao-gia", "?sub=ngan-sach").section).toBe("budgetPlanner");
  });
});
