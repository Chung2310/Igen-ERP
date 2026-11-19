import { expect, it } from "vitest";
import { retailPartnerPerformanceRows } from "./retail-partner-performance";
it("retains zero-activity collaborators, reversals and historical parties", () => {
  expect(retailPartnerPerformanceRows([{ _id: "a", commission: -100, sources: 2 }, { _id: "deleted", commission: 10, sources: 1 }], [{ _id: "a", name: "An", code: "A" }, { _id: "b", name: "Bình", code: "B" }])).toEqual([
    { partnerName: "Đối tác đã ngừng hoạt động", partnerCode: "", commission: 10, sources: 1 },
    { partnerName: "Bình", partnerCode: "B", commission: 0, sources: 0 },
    { partnerName: "An", partnerCode: "A", commission: -100, sources: 2 },
  ]);
});
