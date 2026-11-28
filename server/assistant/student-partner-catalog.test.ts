import { describe, expect, it } from "vitest";
import { operationById } from "./catalog";
import { projectRecords } from "./executor";
import { formatAssistantResult } from "./result-format";

describe("student-partner assistant catalog projection", () => {
  it("projects unpaid balance without exposing bank or payout details", () => {
    const partnerList = operationById("partner.list")!;
    expect(partnerList.resultFields).toContain("unpaidBalance");
    expect(partnerList.resultFields).toContain("hasBankAccount");
    expect(partnerList.resultFields).not.toContain("bankAccountNo");
    expect(partnerList.resultFields).not.toContain("payoutHistory");

    const source = { name: "Đối tác A", unpaidBalance: 1_250_000, bankAccountNo: "1234567890" };
    const [projected] = projectRecords(partnerList, { data: { partners: [source] } }, { user: { companyCode: "company" } } as any);
    expect(projected).toMatchObject({ name: "Đối tác A", unpaidBalance: 1_250_000, hasBankAccount: true });
    expect(JSON.stringify(projected)).not.toContain("1234567890");

    const [partnerWithoutAccount] = projectRecords(partnerList, { data: { partners: [{ name: "Thiếu tài khoản", bankAccountNo: "" }] } }, { user: { companyCode: "company" } } as any);
    expect(partnerWithoutAccount).toMatchObject({ name: "Thiếu tài khoản", hasBankAccount: false });

    const reply = formatAssistantResult(partnerList, [projected]);
    expect(reply).toContain("Đối tác A");
    expect(reply).toContain("1.250.000");
    expect(reply).toContain("Có tài khoản ngân hàng");
    expect(reply).toContain("Có");
    expect(reply).not.toContain("1234567890");
  });

  it("filters partners by missing bank account and positive unpaid commission", () => {
    const partnerList = operationById("partner.list")!;
    const response = { data: { partners: [
      { name: "Thiếu tài khoản và còn nợ", bankAccountNo: "", unpaidBalance: 300_000 },
      { name: "Có tài khoản và còn nợ", bankAccountNo: "1234567890", unpaidBalance: 200_000 },
      { name: "Thiếu tài khoản đã thanh toán", bankAccountNo: "", unpaidBalance: 0 },
    ] } };

    const rows = projectRecords(partnerList, response, { user: { companyCode: "company" } } as any, {
      query_bankAccountFilter: "missing", query_unpaidOnly: true,
    } as any);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Thiếu tài khoản và còn nợ", unpaidBalance: 300_000, hasBankAccount: false });
  });

  it("limits payout history to partner name, date, and amount", () => {
    const payoutHistory = operationById("partner.payout.history.list")!;
    expect(payoutHistory.method).toBe("GET");
    expect(payoutHistory.path).toBe("/partners");
    expect(payoutHistory.resultFields).toEqual(["name", "date", "amount"]);
    expect(payoutHistory.resultChildFields).toBeUndefined();

    const payoutResponse = { success: true, partners: [{
      name: "Đối tác A",
      bankAccountNo: "1234567890",
      payoutHistory: [{ id: "internal-payout-id", date: "2026-11-05", amount: 500_000, method: "Chuyển khoản", note: "private note" }],
    }] };
    const records = projectRecords(payoutHistory, payoutResponse, { user: { companyCode: "company" } } as any);
    const reply = formatAssistantResult(payoutHistory, records);
    expect(reply).toContain("Đối tác A");
    expect(reply).toContain("05/11/2026");
    expect(reply).toContain("500.000");
    expect(reply).not.toContain("1234567890");
    expect(reply).not.toContain("internal-payout-id");
    expect(reply).not.toContain("Chuyển khoản");
    expect(reply).not.toContain("private note");
  });
});
