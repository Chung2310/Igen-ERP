import { describe, expect, it } from "vitest";
import type { RecruitmentApplicant, RecruitmentJob } from "../../types/recruitment";
import { summarizeHrRecruitment } from "./hrRecruitmentOverview";

describe("summarizeHrRecruitment", () => {
  it("filters applicants by the selected period and groups current openings by department", () => {
    const jobs = [
      { _id: "job-a", department: "Kế toán", headcount: 2, status: "open" },
      { _id: "job-b", department: "Kế toán", headcount: 1, status: "open" },
      { _id: "job-c", department: "Kinh doanh", headcount: 3, status: "closed" },
      { _id: "job-d", department: "Kinh doanh", headcount: 4, status: "open" },
    ] as RecruitmentJob[];
    const applicants = [
      { jobId: "job-a", createdAt: "2026-11-02T09:00:00Z" },
      { jobId: "job-b", createdAt: "2026-11-06T09:00:00Z" },
      { jobId: "job-c", createdAt: "2026-11-03T09:00:00Z" },
      { jobId: "job-a", createdAt: "2026-10-20T09:00:00Z" },
    ] as RecruitmentApplicant[];
    const result = summarizeHrRecruitment(jobs, applicants, { from: "2026-11-01", to: "2026-11-06", previousFrom: "2026-10-01", previousTo: "2026-10-31" });

    expect(result.currentApplicantCount).toBe(3);
    expect(result.previousApplicantCount).toBe(1);
    expect(result.openJobCount).toBe(3);
    expect(result.openHeadcount).toBe(7);
    expect(result.departmentRows).toEqual([
      { name: "Kinh doanh", positions: 1, headcount: 4, applicants: 0 },
      { name: "Kế toán", positions: 2, headcount: 3, applicants: 2 },
    ]);
  });
});
