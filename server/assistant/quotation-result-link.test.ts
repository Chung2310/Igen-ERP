import { describe, expect, it } from "vitest";
import { operationById } from "./catalog";
import { quotationResultLink } from "./quotation-result";

const recordId = "64b000000000000000000001";

describe("quotation assistant result links", () => {
  it.each([
    ["quotation.customer-quote.create", `/bao-gia?sub=bao-gia-khach&id=${recordId}`],
    ["quotation.estimate.create", `/bao-gia?sub=du-toan&id=${recordId}`],
    ["quotation.estimate.from-customer", `/bao-gia?sub=du-toan&id=${recordId}`],
    ["quotation.budget.create", `/bao-gia?sub=ngan-sach&plan=${recordId}`],
    ["quotation.contract.create", `/bao-gia?sub=chung-tu&view=hop-dong&id=${recordId}`],
    ["quotation.acceptance.create", `/bao-gia?sub=chung-tu&view=nghiem-thu&id=${recordId}`],
  ])("opens the created record for %s", (operationId, expectedLink) => {
    const op = operationById(operationId)!;
    expect(quotationResultLink(op, { id: recordId })).toBe(expectedLink);
  });

  it("opens the matching section when a create response has no usable record id", () => {
    const op = operationById("quotation.acceptance.create")!;
    expect(quotationResultLink(op, {})).toBe("/bao-gia?sub=chung-tu&view=nghiem-thu");
  });

  it("preserves the operation link for other quotation actions", () => {
    const op = operationById("quotation.acceptance.list")!;
    expect(quotationResultLink(op, {})).toBe(op.link);
  });
});
