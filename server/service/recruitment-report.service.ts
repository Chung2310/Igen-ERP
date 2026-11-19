import { RecruitmentApplicantModel } from "../model/recruitment-applicant.model";
import { RecruitmentInterviewModel } from "../model/recruitment-interview.model";
import { RecruitmentJobModel } from "../model/recruitment-job.model";
import { RecruitmentPipelineModel } from "../model/recruitment-pipeline.model";
import { RecruitmentStageHistoryModel } from "../model/recruitment-stage-history.model";
import { UserModel } from "../model/user.model";
import type { RecruitmentScope } from "../utils/recruitment-scope";

type RecruitmentReportType = "overview" | "interviews" | "interview-count" | "interviewers" | "interview-results" | "hires" | "onboarded" | "job-applications" | "staffing-gaps" | "job-deadlines" | "applicants-by-department";
type ReportInput = { reportType: RecruitmentReportType; from?: string; to?: string; search?: string; rank?: "most" | "least" };

function dateBounds(from?: string, to?: string) {
  const createdAt: Record<string, Date> = {};
  if (from) createdAt.$gte = new Date(`${from}T00:00:00+07:00`);
  if (to) createdAt.$lt = new Date(new Date(`${to}T00:00:00+07:00`).valueOf() + 24 * 60 * 60 * 1000);
  return Object.keys(createdAt).length ? createdAt : undefined;
}
function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function idOf(value: any) { return String(value?._id || value?.id || value || ""); }
function normalize(value: unknown) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLocaleLowerCase("vi"); }
function localToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)?.value || "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
function interval(input: ReportInput) {
  const bound = dateBounds(input.from, input.to);
  return bound ? { $gte: bound.$gte || new Date("1970-01-01T00:00:00Z"), $lt: bound.$lt || new Date("9999-12-31T00:00:00Z") } : undefined;
}
function within(scope: RecruitmentScope) { return { ...scope, isDeleted: false }; }

async function interviewReport(scope: RecruitmentScope, input: ReportInput) {
  const query: Record<string, any> = { ...within(scope) };
  const scheduledStart = interval(input);
  if (scheduledStart) query.scheduledStart = scheduledStart;
  if (input.search?.trim()) {
    const rx = new RegExp(escapeRegex(input.search.trim()), "i");
    const [jobs, applicants] = await Promise.all([
      RecruitmentJobModel.find({ ...within(scope), $or: [{ title: rx }, { code: rx }] }).select("_id").lean(),
      RecruitmentApplicantModel.find({ ...within(scope), fullName: rx }).select("_id").lean(),
    ]);
    const jobIds = jobs.map((job: any) => job._id);
    const applicantIds = applicants.map((applicant: any) => applicant._id);
    if (!jobIds.length && !applicantIds.length) return { query, rows: [] as any[], total: 0 };
    query.$or = [
      ...(jobIds.length ? [{ jobId: { $in: jobIds } }] : []),
      ...(applicantIds.length ? [{ applicantId: { $in: applicantIds } }] : []),
    ];
  }
  const [rows, total] = await Promise.all([
    RecruitmentInterviewModel.find(query).sort({ scheduledStart: 1 }).limit(500).lean(),
    RecruitmentInterviewModel.countDocuments(query),
  ]);
  return { query, rows, total };
}

async function namedInterviews(scope: RecruitmentScope, rows: any[]) {
  const applicantIds = [...new Set(rows.map(row => idOf(row.applicantId)).filter(Boolean))];
  const jobIds = [...new Set(rows.map(row => idOf(row.jobId)).filter(Boolean))];
  const interviewerIds = [...new Set(rows.flatMap(row => Array.isArray(row.interviewerIds) ? row.interviewerIds.map(idOf) : []).filter(Boolean))];
  const [applicants, jobs, users] = await Promise.all([
    applicantIds.length ? RecruitmentApplicantModel.find({ ...within(scope), _id: { $in: applicantIds } }).select("_id fullName").lean() : [],
    jobIds.length ? RecruitmentJobModel.find({ ...within(scope), _id: { $in: jobIds } }).select("_id title code department").lean() : [],
    interviewerIds.length ? UserModel.find({ companyCode: scope.companyCode, branchId: scope.branchId, _id: { $in: interviewerIds } }).select("_id displayName").lean() : [],
  ]);
  const applicantById = new Map<string, any>(applicants.map((value: any) => [idOf(value), value] as const));
  const jobById = new Map<string, any>(jobs.map((value: any) => [idOf(value), value] as const));
  const userById = new Map<string, any>(users.map((value: any) => [idOf(value), value] as const));
  return rows.map(row => ({
    applicantName: applicantById.get(idOf(row.applicantId))?.fullName || "",
    jobTitle: jobById.get(idOf(row.jobId))?.title || jobById.get(idOf(row.jobId))?.code || "",
    scheduledStart: row.scheduledStart,
    scheduledEnd: row.scheduledEnd,
    interviewers: (Array.isArray(row.interviewerIds) ? row.interviewerIds : []).map((id: any) => userById.get(idOf(id))?.displayName).filter(Boolean).join(", "),
    format: row.format,
    status: row.status,
    result: row.result || "",
  }));
}

async function stageEvents(scope: RecruitmentScope, input: ReportInput, type: "hires" | "onboarded") {
  const pipeline: any = await RecruitmentPipelineModel.findOne({ ...scope, isDeleted: false }).lean();
  const stages = (pipeline?.stages || []).filter((stage: any) => type === "hires"
    ? stage.terminalOutcome === "hired"
    : /(?:onboard|nhan viec|tiep nhan nhan su)/.test(normalize(stage.name)));
  if (!stages.length) return { configured: false, items: [], total: null as number | null, summary: type === "hires" ? "Quy trình chưa có bước kết thúc được đánh dấu là đã tuyển." : "Quy trình chưa có bước nhận việc hoặc onboarding để thống kê." };
  const createdAt = dateBounds(input.from, input.to);
  const historyQuery: Record<string, any> = { ...within(scope), toStageId: { $in: stages.map((stage: any) => stage.id) } };
  if (createdAt) historyQuery.createdAt = createdAt;
  const histories = await RecruitmentStageHistoryModel.find(historyQuery).sort({ createdAt: -1 }).limit(1000).lean();
  const latestByApplicant = new Map<string, any>();
  for (const event of histories) if (!latestByApplicant.has(idOf(event.applicantId))) latestByApplicant.set(idOf(event.applicantId), event);
  const events = [...latestByApplicant.values()];
  const applicantIds = events.map(event => idOf(event.applicantId));
  const applicants = applicantIds.length ? await RecruitmentApplicantModel.find({ ...within(scope), _id: { $in: applicantIds } }).select("_id fullName jobId outcome").lean() : [];
  const jobs = applicants.length ? await RecruitmentJobModel.find({ ...within(scope), _id: { $in: applicants.map((row: any) => row.jobId) } }).select("_id title code").lean() : [];
  const applicantById = new Map(applicants.map((value: any) => [idOf(value), value]));
  const jobById = new Map(jobs.map((value: any) => [idOf(value), value]));
  const items = events.flatMap(event => {
    const applicant: any = applicantById.get(idOf(event.applicantId));
    if (!applicant) return [];
    const job: any = jobById.get(idOf(applicant.jobId));
    return [{ name: applicant.fullName, jobTitle: job?.title || job?.code || "", outcome: applicant.outcome, occurredAt: event.createdAt }];
  });
  return { configured: true, items, total: items.length, summary: `${items.length} hồ sơ trong khoảng thời gian đã chọn.` };
}

async function aggregateApplicationRows(scope: RecruitmentScope) {
  const [jobs, applicants] = await Promise.all([
    RecruitmentJobModel.find({ ...within(scope), status: "open" }).select("_id title code department headcount applicationDeadline status").lean(),
    RecruitmentApplicantModel.find({ ...within(scope), outcome: { $in: ["active", "hired"] } }).select("_id jobId outcome").lean(),
  ]);
  const applications = new Map<string, number>();
  const hires = new Map<string, number>();
  for (const applicant of applicants as any[]) {
    const key = idOf(applicant.jobId);
    if (applicant.outcome === "active") applications.set(key, (applications.get(key) || 0) + 1);
    if (applicant.outcome === "hired") hires.set(key, (hires.get(key) || 0) + 1);
  }
  return { jobs: jobs as any[], applicants: applicants as any[], applications, hires };
}

export async function recruitmentAssistantReport(scope: RecruitmentScope, input: ReportInput) {
  const { reportType } = input;
  if (reportType === "overview") {
    const [openJobs, activeApplicants, interviews] = await Promise.all([
      RecruitmentJobModel.countDocuments({ ...within(scope), status: "open" }),
      RecruitmentApplicantModel.countDocuments({ ...within(scope), outcome: "active" }),
      RecruitmentInterviewModel.countDocuments({ ...within(scope), status: "scheduled", scheduledStart: { $gte: new Date() } }),
    ]);
    return { reportType, summary: "Tổng quan tuyển dụng trong chi nhánh.", total: openJobs + activeApplicants + interviews, items: [
      { name: "Vị trí đang tuyển", count: openJobs },
      { name: "Ứng viên đang trong quy trình", count: activeApplicants },
      { name: "Lịch phỏng vấn sắp tới", count: interviews },
    ] };
  }
  if (["interviews", "interview-count", "interviewers", "interview-results"].includes(reportType)) {
    const { rows, total } = await interviewReport(scope, input);
    if (reportType === "interview-count") return { reportType, summary: `Có ${total} lịch phỏng vấn trong khoảng thời gian đã chọn.`, total, items: [] };
    const items = await namedInterviews(scope, rows);
    return { reportType, summary: `${total} lịch phỏng vấn phù hợp.`, total, items };
  }
  if (reportType === "hires" || reportType === "onboarded") return { reportType, ...(await stageEvents(scope, input, reportType)) };

  const { jobs, applicants, applications, hires } = await aggregateApplicationRows(scope);
  if (reportType === "job-applications") {
    const ranked = jobs.map(job => ({ title: job.title || job.code, code: job.code, department: job.department || "", count: applications.get(idOf(job)) || 0 }));
    ranked.sort((a, b) => input.rank === "least" ? a.count - b.count || a.title.localeCompare(b.title, "vi") : b.count - a.count || a.title.localeCompare(b.title, "vi"));
    const items = ranked.slice(0, 10);
    return { reportType, summary: items.length ? `Xếp hạng ${items.length} vị trí đang tuyển theo số hồ sơ.` : "Chưa có vị trí đang tuyển.", total: items.length, items };
  }
  if (reportType === "staffing-gaps") {
    const byDepartment = new Map<string, { name: string; headcount: number; filled: number; gap: number; count: number }>();
    for (const job of jobs) {
      const name = String(job.department || "Chưa phân loại");
      const row = byDepartment.get(name) || { name, headcount: 0, filled: 0, gap: 0, count: 0 };
      row.headcount += Number(job.headcount || 0);
      row.filled += hires.get(idOf(job)) || 0;
      row.count += 1;
      byDepartment.set(name, row);
    }
    const items = [...byDepartment.values()].map(row => ({ ...row, gap: Math.max(0, row.headcount - row.filled) })).filter(row => row.gap > 0).sort((a, b) => b.gap - a.gap);
    return { reportType, summary: `${items.length} phòng ban có vị trí đang tuyển còn thiếu người.`, total: items.length, items };
  }
  if (reportType === "job-deadlines") {
    const rx = input.search?.trim() ? new RegExp(escapeRegex(input.search.trim()), "i") : null;
    const matched = jobs.filter(job => !rx || rx.test(String(job.title || "")) || rx.test(String(job.code || "")));
    const today = localToday();
    const items = matched.map(job => {
      const deadline = job.applicationDeadline ? new Date(job.applicationDeadline) : null;
      const deadlineDate = deadline ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(deadline) : "";
      return { title: job.title, code: job.code, department: job.department || "", applicationDeadline: job.applicationDeadline || null, status: job.status, expired: Boolean(deadlineDate && deadlineDate < today) };
    });
    return { reportType, summary: `${items.length} vị trí đang tuyển phù hợp.`, total: items.length, items };
  }
  if (reportType === "applicants-by-department") {
    const byDepartment = new Map<string, number>();
    const departmentByJob = new Map(jobs.map(job => [idOf(job), String(job.department || "Chưa phân loại")]));
    for (const applicant of applicants as any[]) {
      if (applicant.outcome !== "active") continue;
      const department = departmentByJob.get(idOf(applicant.jobId));
      if (department) byDepartment.set(department, (byDepartment.get(department) || 0) + 1);
    }
    const items = [...byDepartment].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "vi"));
    return { reportType, summary: `${items.length} phòng ban có ứng viên đang ứng tuyển.`, total: items.length, items };
  }
  throw new Error("Recruitment report type is not supported");
}
