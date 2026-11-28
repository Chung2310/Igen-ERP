import { beforeEach, expect, it, vi } from "vitest";
import { Types } from "mongoose";

const state = vi.hoisted(() => ({ jobs: [] as any[], applicants: [] as any[], interviews: [] as any[], interviewFilters: [] as any[], histories: [] as any[], historyFilters: [] as any[], historyPipelines: [] as any[][], pipeline: null as any, users: [] as any[], interviewTotal: 0 }));
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
vi.mock("../model/recruitment-stage-history.model", () => ({ RecruitmentStageHistoryModel: { aggregate: vi.fn((pipeline: any[]) => {
  state.historyPipelines.push(pipeline);
  state.historyFilters.push(pipeline[0]?.$match);
  return Promise.resolve(structuredClone(state.histories));
}) } }));
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
  state.historyFilters = [];
  state.historyPipelines = [];
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

it("returns each onboarded applicant with the department of the associated role", async () => {
  state.pipeline = { stages: [{ id: "onboarded", name: "Onboard", terminalOutcome: "hired" }] };
  state.histories = [
    { applicantId: "candidate-1", toStageId: "onboarded", createdAt: new Date("2026-11-10T04:00:00.000Z") },
    { applicantId: "candidate-4", toStageId: "onboarded", createdAt: new Date("2026-11-11T04:00:00.000Z") },
  ];

  const result = await recruitmentAssistantReport(scope, { reportType: "onboarded", from: "2026-11-01", to: "2026-11-30" });

  expect(result.total).toBe(2);
  expect(result.items).toMatchObject([
    { name: "Nguy\u1ec5n An", jobTitle: "QA Lead", department: "S\u1ea3n ph\u1ea9m" },
    { name: "Tr\u1ea7n Minh", jobTitle: "K\u1ebf to\u00e1n", department: "T\u00e0i ch\u00ednh" },
  ]);
  expect(state.historyFilters[0].createdAt.$gte.toISOString()).toBe("2026-10-31T17:00:00.000Z");
  expect(state.historyFilters[0].createdAt.$lt.toISOString()).toBe("2026-11-30T17:00:00.000Z");
  expect(state.historyPipelines[0]).toEqual(expect.arrayContaining([
    { $group: { _id: "$applicantId", event: { $first: "$$ROOT" } } },
    { $replaceRoot: { newRoot: "$event" } },
  ]));
  expect(state.historyPipelines[0].some(stage => "$limit" in stage)).toBe(false);
});

it("casts the branch id for onboarding aggregation while keeping string ids in non-Mongo tests", async () => {
  state.pipeline = { stages: [{ id: "onboarded", name: "Onboard", terminalOutcome: "hired" }] };
  state.histories = [{ applicantId: "candidate-1", toStageId: "onboarded", createdAt: new Date("2026-11-10T04:00:00.000Z") }];

  await recruitmentAssistantReport({ ...scope, branchId: "507f1f77bcf86cd799439011" }, { reportType: "onboarded" });

  expect(state.historyFilters[0].branchId).toEqual(new Types.ObjectId("507f1f77bcf86cd799439011"));
});

it("uses the hired terminal step when the pipeline has no separate onboarding step", async () => {
  state.pipeline = { stages: [
    { id: "offer", name: "\u0110\u1ec1 ngh\u1ecb nh\u1eadn vi\u1ec7c", terminalOutcome: null },
    { id: "hired", name: "\u0110\u00e3 tuy\u1ec3n", terminalOutcome: "hired" },
  ] };
  state.histories = [
    { applicantId: "candidate-3", toStageId: "hired", createdAt: new Date("2026-11-10T04:00:00.000Z") },
  ];

  const result = await recruitmentAssistantReport(scope, { reportType: "onboarded", from: "2026-11-01", to: "2026-11-30" });

  expect(result.total).toBe(1);
  expect(result.items).toMatchObject([{ name: "Mai Anh", department: "S\u1ea3n ph\u1ea9m" }]);
  expect(state.historyFilters[0].toStageId.$in).toEqual(["hired"]);
});

it("returns a confirmed zero when no applicant entered the hired stage during the month", async () => {
  state.pipeline = { stages: [{ id: "hired", name: "\u0110\u00e3 tuy\u1ec3n", terminalOutcome: "hired" }] };
  state.histories = [];

  const result = await recruitmentAssistantReport(scope, { reportType: "onboarded", from: "2026-11-01", to: "2026-11-30" });

  expect(result.total).toBe(0);
  expect(result.summary).toContain("0 \u1ee9ng vi\u00ean \u0111\u00e3 onboard");
});

it("does not truncate onboarded applicants after one thousand matching events", async () => {
  state.pipeline = { stages: [{ id: "onboarded", name: "Onboard", terminalOutcome: "hired" }] };
  state.histories = Array.from({ length: 1005 }, (_, index) => ({
    applicantId: `candidate-${index}`,
    toStageId: "onboarded",
    createdAt: new Date(Date.UTC(2026, 10, 1) + index * 1000),
  }));
  state.applicants = state.histories.map((event, index) => ({
    _id: event.applicantId,
    fullName: `Ứng viên ${index}`,
    jobId: "job-1",
    outcome: "active",
  }));

  const result = await recruitmentAssistantReport(scope, { reportType: "onboarded", from: "2026-11-01", to: "2026-11-30" });

  expect(result.total).toBe(1005);
  expect(result.items).toHaveLength(1005);
  expect(state.historyFilters[0]).toMatchObject({ ...scope, isDeleted: false, toStageId: { $in: ["onboarded"] } });
  expect(state.historyPipelines[0].some(stage => "$limit" in stage)).toBe(false);
});

it("reports when the pipeline has no stage configured for onboarding", async () => {
  state.pipeline = { stages: [] };
  const result = await recruitmentAssistantReport(scope, { reportType: "onboarded" });
  expect(result.total).toBeNull();
  expect(result.summary).toContain("chưa có bước nhận việc");
});
