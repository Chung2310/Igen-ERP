import type { RecruitmentApplicant, RecruitmentJob } from "../../types/recruitment";
import { overviewDateKey } from "./overviewComparison";

type Period = { from: string; to: string; previousFrom: string; previousTo: string };

export function summarizeHrRecruitment(jobs: RecruitmentJob[] | null, applicants: RecruitmentApplicant[] | null, period: Period | null) {
  const inRange = (applicant: RecruitmentApplicant, from: string, to: string) => {
    const date = overviewDateKey(applicant.createdAt);
    return date != null && date >= from && date <= to;
  };
  const currentApplicants = period && applicants ? applicants.filter(applicant => inRange(applicant, period.from, period.to)) : null;
  const previousApplicantCount = period && applicants ? applicants.filter(applicant => inRange(applicant, period.previousFrom, period.previousTo)).length : null;
  const applicantsByJob = new Map<string, number>();
  for (const applicant of currentApplicants ?? []) applicantsByJob.set(applicant.jobId, (applicantsByJob.get(applicant.jobId) ?? 0) + 1);
  const openJobs = (jobs ?? []).filter(job => job.status === "open");
  const departmentRows = [...openJobs.reduce((groups, job) => {
    const name = job.department.trim() || "Chưa phân phòng ban";
    const row = groups.get(name) ?? { name, positions: 0, headcount: 0, applicants: 0 };
    row.positions += 1;
    row.headcount += job.headcount;
    row.applicants += applicantsByJob.get(job._id) ?? 0;
    groups.set(name, row);
    return groups;
  }, new Map<string, { name: string; positions: number; headcount: number; applicants: number }>()).values()].sort((a, b) => b.headcount - a.headcount || a.name.localeCompare(b.name, "vi"));

  return { currentApplicantCount: currentApplicants?.length ?? null, previousApplicantCount, openJobCount: openJobs.length, openHeadcount: openJobs.reduce((sum, job) => sum + job.headcount, 0), departmentRows };
}
