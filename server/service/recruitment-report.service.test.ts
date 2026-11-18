import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ jobs: [] as any[], applicants: [] as any[], interviews: [] as any[], interviewFilters: [] as any[], histories: [] as any[], pipeline: null as any, users: [] as any[], interviewTotal: 0 }));
vi.mock("../model/recruitment-applicant.model", () => ({ RecruitmentApplicantModel: {
  find: vi.fn(() => query(state.applicants)), countDocuments: vi.fn(async () => state.applicants.length),
} }));
vi.mock("../model/recruitment-job.model", () => ({ RecruitmentJobModel: {
  find: vi.fn(() => query(state.jobs)), countDocuments: vi.fn(async () => state.jobs.length),
} }));
vi.mock("../model/recruitment-interview.model", () => ({ RecruitmentInterviewModel: {
  find: vi.fn((filter: any) => { state.interviewFilters.push(filter); return query(state.interviews); }), countDocuments: vi.fn(async () => state.interviewTotal),
} }));
vi.mock("../model/recruitment-pipeline.model", () => ({ RecruitmentPipelineModel: { findOne: vi.fn(() => ({ lean: async () => structuredClone(state.pipeline) })) } }));
vi.mock("../model/recruitment-stage-history.model", () => ({ RecruitmentStageHistoryModel: { find: vi.fn(() => query(state.histories)) } }));
vi.mock("../model/user.model", () => ({ UserModel: { find: vi.fn(() => query(state.users)) } }));

function query(rows: any[]) {
  const result: any = {
    select: () => result,
    sort: () => result,
    limit: () => result,
    lean: async () => structuredClone(rows),
  };
  return result;
}

import { recruitmentAssistantReport } from "./recruitment-report.service";

const scope = { companyCode: "TEST", branchId: "branch-1" };
beforeEach(() => {
  state.jobs = [
    { _id: "job-1", title: "QA Lead", code: "JOB-1", department: "Sản phẩm", status: "open", headcount: 3, applicationDeadline: "2026-12-01" },
    { _id: "job-2", title: "Kế toán", code: "JOB-2", department: "Tài chính", status: "open", headcount: 1, applicationDeadline: "2026-12-15" },
  ];
  state.applicants = [
    { _id: "candidate-1", fullName: "Nguyễn An", jobId: "job-1", outcome: "active" },
    { _id: "candidate-2", fullName: "Lê Bảo", jobId: "job-1", outcome: "active" },
    { _id: "candidate-3", fullName: "Mai Anh", jobId: "job-1", outcome: "hired" },
    { _id: "candidate-4", fullName: "Trần Minh", jobId: "job-2", outcome: "active" },
  ];
  state.interviews = [{ _id: "interview-1", applicantId: "candidate-1", jobId: "job-1", scheduledStart: "2026-11-18T02:00:00.000Z", scheduledEnd: "2026-11-18T03:00:00.000Z", interviewerIds: ["employee-1"], status: "completed", result: "Đạt" }];
  state.interviewFilters = [];
  state.interviewTotal = 17;
  state.histories = [];
  state.pipeline = { stages: [{ id: "hired", name: "Đã nhận việc", terminalOutcome: "hired" }] };
  state.users = [{ _id: "employee-1", displayName: "Võ Minh Quân" }];
});

it("ranks open roles using active applications and groups active candidates by department", async () => {
  const ranked = await recruitmentAssistantReport(scope, { reportType: "job-applications", rank: "most" });
  expect(ranked.items).toEqual([
    { title: "QA Lead", code: "JOB-1", department: "Sản phẩm", count: 2 },
    { title: "Kế toán", code: "JOB-2", department: "Tài chính", count: 1 },
  ]);

  const grouped = await recruitmentAssistantReport(scope, { reportType: "applicants-by-department" });
  expect(grouped.items).toEqual([{ name: "Sản phẩm", count: 2 }, { name: "Tài chính", count: 1 }]);
});

it("counts all matching interview records even when the displayed list is capped", async () => {
  const result = await recruitmentAssistantReport(scope, { reportType: "interview-count", from: "2026-11-01", to: "2026-11-30" });
  expect(result.total).toBe(17);
  expect(result.items).toEqual([]);
});

it("resolves interviewer names while returning only recruiting fields", async () => {
  const result = await recruitmentAssistantReport(scope, { reportType: "interviewers", from: "2026-11-18", to: "2026-11-18" });
  expect(result.items).toMatchObject([{ applicantName: "Nguyễn An", jobTitle: "QA Lead", interviewers: "Võ Minh Quân" }]);
  expect(state.interviewFilters[0].scheduledStart.$gte.toISOString()).toBe("2026-11-17T17:00:00.000Z");
  expect(state.interviewFilters[0].scheduledStart.$lt.toISOString()).toBe("2026-11-18T17:00:00.000Z");
  expect(JSON.stringify(result)).not.toContain("employee-1");
  expect(JSON.stringify(result)).not.toContain("candidate-1");
});

it("reports when the pipeline has no stage configured for onboarding", async () => {
  state.pipeline = { stages: [{ id: "hired", name: "Phỏng vấn cuối", terminalOutcome: "hired" }] };
  const result = await recruitmentAssistantReport(scope, { reportType: "onboarded" });
  expect(result.total).toBeNull();
  expect(result.summary).toContain("chưa có bước nhận việc");
});
