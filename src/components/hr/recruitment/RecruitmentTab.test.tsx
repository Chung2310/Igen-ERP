// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recruitmentApi } from "../../../services/recruitmentService";
import RecruitmentTab from "./RecruitmentTab";

vi.mock("../../../services/recruitmentService", () => ({ recruitmentApi: {
  listJobs: vi.fn(), getPipeline: vi.fn(), listApplicants: vi.fn(), listInterviews: vi.fn(),
  createJob: vi.fn(), updateJob: vi.fn(), changeJobStatus: vi.fn(), createApplicant: vi.fn(), updateApplicant: vi.fn(),
  uploadPublicFile: vi.fn(), deleteTemporaryPublicFile: vi.fn(),
} }));

const job = { _id: "job", code: "DEV", title: "Developer", department: "IT", headcount: 2, description: "", requirements: "", benefits: "", showSalary: false, employmentType: "full_time", workplaceType: "onsite", location: "HCM", status: "open", version: 0, companyCode: "ACME", branchId: "branch-a", createdBy: "creator", updatedBy: "updater", isDeleted: false, deletedAt: null, deletedBy: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as any;
const applicant = { _id: "app", jobId: "job", stageId: "new", fullName: "Nguyễn An", email: "an@example.com", phone: "", address: "", experience: "", education: "", skills: [], source: "", notes: "", outcome: "active", version: 0, createdAt: new Date().toISOString() } as any;

describe("RecruitmentTab", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.mocked(recruitmentApi.listJobs).mockResolvedValue([job]);
    vi.mocked(recruitmentApi.getPipeline).mockResolvedValue({ _id: "pipe", version: 0, stages: [{ id: "new", name: "Hồ sơ mới", color: "#000", position: 0, isActive: true }] });
    vi.mocked(recruitmentApi.listApplicants).mockResolvedValue([]);
    vi.mocked(recruitmentApi.listInterviews).mockResolvedValue([]);
    vi.mocked(recruitmentApi.createJob).mockResolvedValue({ ...job, _id: "new-job" });
    vi.mocked(recruitmentApi.createApplicant).mockResolvedValue({ ...applicant, _id: "new-applicant" });
    vi.mocked(recruitmentApi.updateJob).mockResolvedValue({ ...job, title: "Senior Developer", version: 1 });
    vi.mocked(recruitmentApi.updateApplicant).mockResolvedValue({ ...applicant, fullName: "Nguyễn An Updated", version: 1 });
    vi.mocked(recruitmentApi.uploadPublicFile).mockImplementation(async (file) => ({ url: `https://cloud.test/${file.name}`, publicId: `public/${file.name}`, originalName: file.name, size: file.size }));
  });

  it("loads jobs and exposes all recruitment views", async () => {
    render(<RecruitmentTab />);
    expect(await screen.findByText("Developer")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ứng viên" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Quy trình" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Phỏng vấn" })).toBeTruthy();
  });

  it("hides recruitment management actions from read-only users", async () => {
    render(<RecruitmentTab canManage={false} />);

    expect(await screen.findByText("Developer")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tạo tin" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sửa tin tuyển dụng DEV" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Trạng thái DEV" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Ứng viên" }));
    expect(await screen.findByText("Chưa có ứng viên trong chi nhánh này.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Thêm ứng viên" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Phỏng vấn" }));
    expect(screen.queryByRole("button", { name: "Lên lịch phỏng vấn" })).toBeNull();
  });

  it("uploads a JD immediately and fills its public link before creating", async () => {
    render(<RecruitmentTab canManage />); await screen.findByText("Developer");
    await userEvent.click(screen.getByRole("button", { name: "Tạo tin" }));
    await userEvent.type(screen.getByLabelText("Mã tin"), "QA");
    await userEvent.type(screen.getByLabelText("Tên vị trí"), "QA Engineer");
    await userEvent.upload(screen.getByLabelText("File JD"), new File(["pdf"], "qa-jd.pdf", { type: "application/pdf" }));
    await waitFor(() => expect((screen.getByLabelText("Link JD") as HTMLInputElement).value).toBe("https://cloud.test/qa-jd.pdf"));
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(recruitmentApi.createJob).toHaveBeenCalledWith(expect.objectContaining({ jdFileUrl: "https://cloud.test/qa-jd.pdf", jdFilePublicId: "public/qa-jd.pdf" })));
    expect(vi.mocked(recruitmentApi.uploadPublicFile).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(recruitmentApi.createJob).mock.invocationCallOrder[0]);
  });

  it("uploads a CV immediately and fills its public link before creating", async () => {
    render(<RecruitmentTab canManage />); await screen.findByText("Developer");
    await userEvent.click(screen.getByRole("button", { name: "Ứng viên" }));
    await userEvent.click(await screen.findByRole("button", { name: "Thêm ứng viên" }));
    await userEvent.selectOptions(screen.getByLabelText("Tin tuyển dụng"), "job");
    await userEvent.type(screen.getByLabelText("Họ tên"), "Nguyễn An");
    await userEvent.upload(screen.getByLabelText("CV"), new File(["docx"], "nguyen-an.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
    await waitFor(() => expect((screen.getByLabelText("Link CV") as HTMLInputElement).value).toBe("https://cloud.test/nguyen-an.docx"));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Thêm ứng viên" }));
    await waitFor(() => expect(recruitmentApi.createApplicant).toHaveBeenCalledWith(expect.objectContaining({ cvUrl: "https://cloud.test/nguyen-an.docx", cvPublicId: "public/nguyen-an.docx" })));
  });

  it("updates a job status from the jobs list instead of the detail dialog", async () => {
    vi.mocked(recruitmentApi.changeJobStatus).mockResolvedValue({ ...job, status: "paused", version: 1 });
    render(<RecruitmentTab canManage />);
    await screen.findByText("Developer");

    const statusSelect = screen.getByRole("combobox", { name: "Trạng thái DEV" }) as HTMLSelectElement;
    expect(statusSelect.value).toBe("open");
    expect(screen.queryByTitle("Mở tuyển")).toBeNull();
    expect(screen.queryByTitle("Tạm dừng")).toBeNull();

    await userEvent.selectOptions(statusSelect, "paused");
    await waitFor(() => expect(recruitmentApi.changeJobStatus).toHaveBeenCalledWith("job", 0, "paused"));

    await userEvent.click(screen.getByRole("button", { name: "Sửa tin tuyển dụng DEV" }));
    expect(within(screen.getByRole("dialog")).queryByLabelText("Trạng thái")).toBeNull();
  });
  it("edits an existing job with its version", async () => {
    render(<RecruitmentTab canManage />); await screen.findByText("Developer");
    await userEvent.click(screen.getByRole("button", { name: "Sửa tin tuyển dụng DEV" }));
    const title = screen.getByLabelText("Tên vị trí"); await userEvent.clear(title); await userEvent.type(title, "Senior Developer");
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(recruitmentApi.updateJob).toHaveBeenCalledWith("job", expect.objectContaining({ title: "Senior Developer", version: 0 })));
    expect(vi.mocked(recruitmentApi.updateJob).mock.calls[0][1]).not.toEqual(expect.objectContaining({ _id: expect.anything(), companyCode: expect.anything(), branchId: expect.anything(), createdBy: expect.anything(), updatedBy: expect.anything(), isDeleted: expect.anything(), createdAt: expect.anything(), updatedAt: expect.anything() }));
  });

  it("edits an applicant and displays its Vietnamese outcome", async () => {
    vi.mocked(recruitmentApi.listApplicants).mockResolvedValue([applicant]);
    render(<RecruitmentTab canManage />); await screen.findByText("Developer"); await userEvent.click(screen.getByRole("button", { name: "Ứng viên" }));
    expect(await screen.findByText("Đang xử lý")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Sửa ứng viên Nguyễn An" }));
    const name = screen.getByLabelText("Họ tên"); await userEvent.clear(name); await userEvent.type(name, "Nguyễn An Updated");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(recruitmentApi.updateApplicant).toHaveBeenCalledWith("app", expect.objectContaining({ fullName: "Nguyễn An Updated", version: 0 })));
  });
});
