import { describe, expect, it } from "vitest";
import { applicantOutcomeLabels, jobStatusLabels } from "./recruitmentLabels";

describe("recruitment labels", () => {
  it("provides Vietnamese labels for stable job statuses and applicant outcomes", () => {
    expect(jobStatusLabels).toEqual({ draft: "Nháp", open: "Đang tuyển", paused: "Tạm dừng", closed: "Đã đóng" });
    expect(applicantOutcomeLabels).toEqual({ active: "Đang xử lý", hired: "Đã tuyển", rejected: "Từ chối", withdrawn: "Đã rút hồ sơ" });
  });
});
