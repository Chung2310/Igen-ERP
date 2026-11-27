import { expect, it, vi } from "vitest";

vi.mock("./workflows", () => ({ actorScope: () => ({}), assertOperation: vi.fn() }));

import { projectRecords } from "./executor";

it("projects partner payout history as safe name, date, and amount rows", () => {
  const operation = {
    id: "partner.payout.history.list",
    module: "student",
    method: "GET",
    path: "/partners",
    resultFields: ["name", "date", "amount"],
  } as any;

  const records = projectRecords(operation, { success: true, data: { partners: [
    { name: "Đối tác A", bankAccountNo: "123456789", payoutHistory: [
      { date: "2026-11-20", amount: 250000, method: "Chuyển khoản", note: "riêng tư", id: "internal-id" },
    ] },
    { name: "Đối tác B", payoutHistory: [] },
  ] } }, {} as any);

  expect(records).toEqual([{ name: "Đối tác A", date: "2026-11-20", amount: 250000 }]);
  expect(JSON.stringify(records)).not.toContain("123456789");
  expect(JSON.stringify(records)).not.toContain("internal-id");
  expect(JSON.stringify(records)).not.toContain("riêng tư");
});
