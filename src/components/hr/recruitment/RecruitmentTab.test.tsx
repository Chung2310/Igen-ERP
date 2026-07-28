// @vitest-environment jsdom
import React from "react";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recruitmentApi } from "../../../services/recruitmentService";
import RecruitmentTab from "./RecruitmentTab";

vi.mock("../../../services/recruitmentService", () => ({
  recruitmentApi: {
    listJobs: vi.fn(),
    getPipeline: vi.fn(),
    listApplicants: vi.fn(),
    listInterviews: vi.fn(),
    createJob: vi.fn(),
    uploadJobAttachment: vi.fn(),
    createApplicant: vi.fn(),
    uploadApplicantAttachment: vi.fn(),
  },
}));

describe("RecruitmentTab", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(recruitmentApi.listJobs).mockResolvedValue([
      {
        _id: "job",
        code: "DEV",
        title: "Developer",
        department: "IT",
        headcount: 2,
        description: "",
        requirements: "",
        benefits: "",
        showSalary: false,
        employmentType: "full_time",
        workplaceType: "onsite",
        location: "HCM",
        status: "open",
        version: 0,
      },
    ]);
    vi.mocked(recruitmentApi.getPipeline).mockResolvedValue({
      _id: "pipe",
      version: 0,
      stages: [],
    });
    vi.mocked(recruitmentApi.listApplicants).mockResolvedValue([]);
    vi.mocked(recruitmentApi.listInterviews).mockResolvedValue([]);
    vi.mocked(recruitmentApi.createJob).mockResolvedValue({
      _id: "new-job",
      code: "QA",
      title: "QA",
      status: "draft",
      version: 0,
    } as any);
    vi.mocked(recruitmentApi.uploadJobAttachment).mockResolvedValue({
      _id: "jd-file",
    } as any);
    vi.mocked(recruitmentApi.createApplicant).mockResolvedValue({
      _id: "new-applicant",
      fullName: "An",
    });
    vi.mocked(recruitmentApi.uploadApplicantAttachment).mockResolvedValue({
      _id: "cv-file",
    } as any);
  });
  it("loads jobs and exposes all recruitment views", async () => {
    render(<RecruitmentTab />);
    expect(await screen.findByText("Developer")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ứng viên" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Quy trình" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Phỏng vấn" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Ứng viên" }));
    await waitFor(() =>
      expect(recruitmentApi.listApplicants).toHaveBeenCalled(),
    );
  });
  it("creates a JD before uploading its selected PDF", async () => {
    render(<RecruitmentTab />);
    await screen.findByText("Developer");
    await userEvent.click(screen.getByRole("button", { name: "Tạo tin" }));
    await userEvent.type(screen.getByLabelText("Mã tin"), "QA");
    await userEvent.type(screen.getByLabelText("Tên vị trí"), "QA Engineer");
    await userEvent.upload(
      screen.getByLabelText("File JD"),
      new File(["pdf"], "qa-jd.pdf", { type: "application/pdf" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() =>
      expect(recruitmentApi.uploadJobAttachment).toHaveBeenCalledWith(
        "new-job",
        expect.objectContaining({ name: "qa-jd.pdf" }),
      ),
    );
    expect(
      vi.mocked(recruitmentApi.createJob).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(recruitmentApi.uploadJobAttachment).mock.invocationCallOrder[0],
    );
  });
  it("creates an applicant before uploading the selected DOCX CV", async () => {
    render(<RecruitmentTab />);
    await screen.findByText("Developer");
    await userEvent.click(screen.getByRole("button", { name: "Ứng viên" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Thêm ứng viên" }),
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Tin tuyển dụng"),
      "job",
    );
    await userEvent.type(screen.getByLabelText("Họ tên"), "Nguyễn An");
    const cv = new File(["docx"], "nguyen-an.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    await userEvent.upload(screen.getByLabelText("CV"), cv);
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Thêm ứng viên",
      }),
    );
    await waitFor(() =>
      expect(recruitmentApi.uploadApplicantAttachment).toHaveBeenCalledWith(
        "new-applicant",
        expect.objectContaining({ name: "nguyen-an.docx" }),
      ),
    );
    expect(
      vi.mocked(recruitmentApi.createApplicant).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(recruitmentApi.uploadApplicantAttachment).mock
        .invocationCallOrder[0],
    );
  });
});
