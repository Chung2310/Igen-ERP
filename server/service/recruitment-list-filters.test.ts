import { expect, it, vi } from "vitest";
const find = vi.hoisted(() => vi.fn(() => ({ sort: () => ({ lean: async () => [] }) })));
vi.mock("../model/recruitment-interview.model", () => ({ RecruitmentInterviewModel: { find } }));
import { interviewDateBounds, listInterviews } from "./recruitment-interview.service";
it("includes the entire Vietnam calendar day but excludes the next day", () => {
  expect(interviewDateBounds("2026-11-18", "2026-11-18")).toEqual({ $gte: new Date("2026-11-17T17:00:00Z"), $lt: new Date("2026-11-18T17:00:00Z") });
});
it("preserves explicit timestamp boundaries", () => {
  expect(interviewDateBounds(undefined, "2026-11-18T09:00:00+07:00")).toEqual({ $lte: new Date("2026-11-18T02:00:00Z") });
});
it.each([false, "false", undefined, true, "true"])("parses the deleted query flag %s", async deleted => {
  await listInterviews({companyCode: "TEST", branchId: "branch"}, {deleted});
  expect(find).toHaveBeenLastCalledWith({companyCode: "TEST", branchId: "branch", isDeleted: deleted === true || deleted === "true"});
});
