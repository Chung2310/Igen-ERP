export type RecruitmentJobStatus = "draft" | "open" | "paused" | "closed";
export type ApplicantOutcome = "active" | "hired" | "rejected" | "withdrawn";
export interface RecruitmentJob {
  _id: string; code: string; title: string; department: string; headcount: number;
  description: string; requirements: string; benefits: string; salaryMin?: number | null; salaryMax?: number | null;
  showSalary: boolean; employmentType: string; workplaceType: "onsite" | "hybrid" | "remote";
  location: string; applicationDeadline?: string | null; status: RecruitmentJobStatus; version: number;
}
export interface RecruitmentStage {
  id: string; name: string; color: string; position: number; isActive: boolean;
  terminalOutcome?: Exclude<ApplicantOutcome, "active"> | null;
}
export interface RecruitmentPipeline { _id: string; stages: RecruitmentStage[]; version: number; }
export interface RecruitmentApplicant {
  _id: string; jobId: string; stageId: string; recruiterId?: string | null; fullName: string; email: string; phone: string;
  birthDate?: string | null; address: string; experience: string; education: string; skills: string[];
  expectedSalary?: number | null; availableDate?: string | null; source: string; notes: string;
  outcome: ApplicantOutcome; version: number; createdAt: string;
}
export interface RecruitmentInterview {
  _id: string; applicantId: string; jobId: string; scheduledStart: string; scheduledEnd: string;
  format: "onsite" | "online" | "phone"; location?: string; meetingLink?: string; interviewerIds: string[];
  status: "scheduled" | "completed" | "cancelled"; result?: string; notes?: string; version: number;
}
export interface RecruitmentHistory {
  _id: string; fromStageName?: string; toStageName: string; note?: string; actorId: string; createdAt: string;
}
export interface RecruitmentAttachment { _id: string; originalName: string; mimeType: string; size: number; createdAt: string; }
