// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HrAnalyticsPanels } from "./HrAnalyticsPanels";

const base = {
  summary: null,
  previousSummary: null,
  yesterdayAttendance: null,
  applicants: [],
  jobs: [],
  pipeline: null,
  loading: false,
};

describe("HrAnalyticsPanels", () => {
  it("does not show attendance or recruitment data without permission", () => {
    render(<HrAnalyticsPanels {...base} canSeeTimekeeping={false} canSeeRecruitment={false} />);
    expect(screen.queryByText("Chấm công hôm nay")).toBeNull();
    expect(screen.queryByText("Ứng viên mới 6 tháng")).toBeNull();
    expect(screen.getByText("Việc cần chú ý")).toBeTruthy();
  });

  it("shows recruitment charts and counts when permitted", () => {
    render(<HrAnalyticsPanels {...base} canSeeTimekeeping={false} canSeeRecruitment jobs={[{ _id: "job-1", code: "J1", title: "Kế toán", department: "Tài chính", headcount: 2, description: "", requirements: "", benefits: "", showSalary: false, employmentType: "full-time", workplaceType: "onsite", location: "", status: "open", version: 1 }]} />);
    expect(screen.getByText("Ứng viên mới 6 tháng")).toBeTruthy();
    expect(screen.getByText("Nhu cầu tuyển dụng")).toBeTruthy();
    expect(screen.getByText("Chỉ tiêu tuyển").parentElement?.textContent).toContain("2");
  });
});
