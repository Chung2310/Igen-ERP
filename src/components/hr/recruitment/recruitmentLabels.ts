import type { ApplicantOutcome, RecruitmentJobStatus } from "../../../types/recruitment";

export const jobStatusLabels: Record<RecruitmentJobStatus, string> = { draft: "Nháp", open: "Đang tuyển", paused: "Tạm dừng", closed: "Đã đóng" };
export const applicantOutcomeLabels: Record<ApplicantOutcome, string> = { active: "Đang xử lý", hired: "Đã tuyển", rejected: "Từ chối", withdrawn: "Đã rút hồ sơ" };
