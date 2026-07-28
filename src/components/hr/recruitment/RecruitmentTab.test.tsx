// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { recruitmentApi } from "../../../services/recruitmentService";
import RecruitmentTab from "./RecruitmentTab";

vi.mock("../../../services/recruitmentService", () => ({ recruitmentApi: {
  listJobs: vi.fn(), getPipeline: vi.fn(), listApplicants: vi.fn(), listInterviews: vi.fn(),
} }));

describe("RecruitmentTab", () => {
  beforeEach(() => {
    vi.mocked(recruitmentApi.listJobs).mockResolvedValue([{ _id: "job", code: "DEV", title: "Developer", department: "IT", headcount: 2, description: "", requirements: "", benefits: "", showSalary: false, employmentType: "full_time", workplaceType: "onsite", location: "HCM", status: "open", version: 0 }]);
    vi.mocked(recruitmentApi.getPipeline).mockResolvedValue({ _id: "pipe", version: 0, stages: [] });
    vi.mocked(recruitmentApi.listApplicants).mockResolvedValue([]);
    vi.mocked(recruitmentApi.listInterviews).mockResolvedValue([]);
  });
  it("loads jobs and exposes all recruitment views", async () => {
    render(<RecruitmentTab />);
    expect(await screen.findByText("Developer")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ứng viên" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Quy trình" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Phỏng vấn" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Ứng viên" }));
    await waitFor(() => expect(recruitmentApi.listApplicants).toHaveBeenCalled());
  });
});
