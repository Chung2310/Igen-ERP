// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recruitmentApi } from "../../../services/recruitmentService";
import { authService } from "../../../services/authService";
import { toast } from "../../../pages/Toast";
import RecruitmentInterviewsView from "./RecruitmentInterviewsWorkspace";

vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({ userProfile: { companyCode: "ACME" } }),
}));
vi.mock("../../../context/BranchContext", () => ({
  useBranch: () => ({ activeBranchId: "branch-a" }),
}));
vi.mock("../../../services/authService", () => ({ authService: {
  getUsersByCompany: vi.fn(),
} }));
vi.mock("../../../services/recruitmentService", () => ({ recruitmentApi: {
  listInterviews: vi.fn(), listApplicants: vi.fn(), listJobs: vi.fn(),
  createInterview: vi.fn(), updateInterview: vi.fn(), deleteInterview: vi.fn(),
} }));
vi.mock("../../../pages/Toast", () => ({ toast: {
  success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(),
} }));

const applicant = { _id: "applicant-1", jobId: "job-1", fullName: "Nguyễn An" } as any;
const job = { _id: "job-1", title: "Developer" } as any;
const interview = {
  _id: "interview-1",
  applicantId: "applicant-1",
  jobId: "job-1",
  scheduledStart: "2030-01-02T02:00:00.000Z",
  scheduledEnd: "2030-01-02T03:00:00.000Z",
  format: "online",
  location: "",
  meetingLink: "https://meet.example.com/old",
  interviewerIds: ["user-1"],
  status: "scheduled",
  result: "Chưa có",
  notes: "Vòng kỹ thuật",
  version: 3,
} as any;

describe("RecruitmentInterviewsView", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(recruitmentApi.listInterviews).mockResolvedValue([interview]);
    vi.mocked(recruitmentApi.listApplicants).mockResolvedValue([applicant]);
    vi.mocked(recruitmentApi.listJobs).mockResolvedValue([job]);
    vi.mocked(recruitmentApi.updateInterview).mockResolvedValue({ ...interview, version: 4 });
    vi.mocked(recruitmentApi.createInterview).mockResolvedValue(interview);
    vi.mocked(recruitmentApi.deleteInterview).mockResolvedValue({} as any);
    vi.mocked(authService.getUsersByCompany).mockResolvedValue([
      { uid: "user-1", displayName: "Trần Minh" },
      { uid: "user-2", displayName: "Lê Hoa" },
    ] as any);
  });

  it("edits an interview in the shared popup without allowing applicant changes", async () => {
    render(<RecruitmentInterviewsView canManage />);
    await screen.findByText("Nguyễn An");

    await userEvent.click(screen.getByRole("button", { name: "Sửa lịch phỏng vấn Nguyễn An" }));
    const dialog = screen.getByRole("dialog", { name: "Sửa lịch phỏng vấn" });
    expect((within(dialog).getByLabelText("Ứng viên") as HTMLSelectElement).disabled).toBe(true);
    expect((within(dialog).getByLabelText("Vị trí") as HTMLInputElement).disabled).toBe(true);
    expect((within(dialog).getByLabelText("Ghi chú") as HTMLTextAreaElement).value).toBe("Vòng kỹ thuật");
    expect((within(dialog).getByLabelText("Trạng thái") as HTMLSelectElement).value).toBe("scheduled");
    expect((within(dialog).getByLabelText("Kết quả") as HTMLInputElement).value).toBe("Chưa có");

    await userEvent.selectOptions(within(dialog).getByLabelText("Trạng thái"), "completed");
    await userEvent.clear(within(dialog).getByLabelText("Kết quả"));
    await userEvent.type(within(dialog).getByLabelText("Kết quả"), "Đạt");
    await userEvent.deselectOptions(within(dialog).getByLabelText("Người phỏng vấn"), ["user-1"]);
    await userEvent.selectOptions(within(dialog).getByLabelText("Người phỏng vấn"), ["user-2"]);
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(recruitmentApi.updateInterview).toHaveBeenCalledWith(
      "interview-1",
      expect.objectContaining({ status: "completed", result: "Đạt", interviewerIds: ["user-2"], version: 3 }),
    ));
    const payload = vi.mocked(recruitmentApi.updateInterview).mock.calls[0][1];
    expect(payload).not.toHaveProperty("applicantId");
    expect(payload).not.toHaveProperty("jobId");
    expect(toast.success).toHaveBeenCalledWith("Đã cập nhật lịch phỏng vấn của Nguyễn An.");
  });

  it("removes inactive interviewers from an existing interview before updating", async () => {
    vi.mocked(authService.getUsersByCompany).mockResolvedValue([
      { uid: "user-1", displayName: "Inactive interviewer", isActive: false },
      { uid: "user-2", displayName: "Active interviewer", isActive: true },
    ] as any);
    render(<RecruitmentInterviewsView canManage />);
    await screen.findByText("Nguyễn An");

    await userEvent.click(screen.getByRole("button", { name: "Sửa lịch phỏng vấn Nguyễn An" }));
    const dialog = screen.getByRole("dialog", { name: "Sửa lịch phỏng vấn" });
    expect(within(dialog).queryByRole("option", { name: "Inactive interviewer" })).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(recruitmentApi.updateInterview).toHaveBeenCalledWith(
      "interview-1",
      expect.objectContaining({ interviewerIds: [], version: 3 }),
    ));
  });

  it("continues creating interviews from the shared popup", async () => {
    render(<RecruitmentInterviewsView canManage />);
    await screen.findByText("Nguyễn An");

    await userEvent.click(screen.getByRole("button", { name: "Lên lịch phỏng vấn" }));
    const dialog = screen.getByRole("dialog", { name: "Lên lịch phỏng vấn" });
    await userEvent.selectOptions(within(dialog).getByLabelText("Ứng viên"), "applicant-1");
    await userEvent.type(within(dialog).getByLabelText("Bắt đầu"), "2030-02-01T09:00");
    expect((within(dialog).getByLabelText("Kết thúc") as HTMLInputElement).value).toBe("2030-02-01T10:00");
    await userEvent.click(within(dialog).getByRole("button", { name: "Tạo lịch" }));

    await waitFor(() => expect(recruitmentApi.createInterview).toHaveBeenCalledWith(expect.objectContaining({ applicantId: "applicant-1", jobId: "job-1", status: "scheduled" })));
    expect(toast.success).toHaveBeenCalledWith("Đã tạo lịch phỏng vấn.");
  });

  it("defaults the interview end to one hour after the selected start", async () => {
    render(<RecruitmentInterviewsView canManage />);
    await screen.findByText("Nguyễn An");
    await userEvent.click(screen.getByRole("button", { name: "Lên lịch phỏng vấn" }));
    const dialog = screen.getByRole("dialog", { name: "Lên lịch phỏng vấn" });

    await userEvent.type(within(dialog).getByLabelText("Bắt đầu"), "2030-02-01T09:00");

    expect((within(dialog).getByLabelText("Kết thúc") as HTMLInputElement).value).toBe("2030-02-01T10:00");
    expect((within(dialog).getByLabelText("Kết thúc") as HTMLInputElement).min).toBe("2030-02-01T09:00");
  });

  it("stops an invalid interview time range before calling the API", async () => {
    render(<RecruitmentInterviewsView canManage />);
    await screen.findByText("Nguyễn An");
    await userEvent.click(screen.getByRole("button", { name: "Lên lịch phỏng vấn" }));
    const dialog = screen.getByRole("dialog", { name: "Lên lịch phỏng vấn" });
    await userEvent.selectOptions(within(dialog).getByLabelText("Ứng viên"), "applicant-1");
    await userEvent.type(within(dialog).getByLabelText("Bắt đầu"), "2030-02-01T10:00");
    await userEvent.clear(within(dialog).getByLabelText("Kết thúc"));
    await userEvent.type(within(dialog).getByLabelText("Kết thúc"), "2030-02-01T09:00");

    await userEvent.click(within(dialog).getByRole("button", { name: "Tạo lịch" }));

    expect(recruitmentApi.createInterview).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Thời gian kết thúc phải sau thời gian bắt đầu.");
  });

  it("requires confirmation before deleting an interview and reports success", async () => {
    render(<RecruitmentInterviewsView canManage />);
    await screen.findByText("Nguyễn An");

    await userEvent.click(screen.getByRole("button", { name: "Xóa lịch phỏng vấn Nguyễn An" }));
    expect(recruitmentApi.deleteInterview).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Xóa lịch phỏng vấn?" })).toBeTruthy();

    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Hủy" }));
    expect(recruitmentApi.deleteInterview).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Xóa lịch phỏng vấn Nguyễn An" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xóa lịch" }));

    await waitFor(() => expect(recruitmentApi.deleteInterview).toHaveBeenCalledWith("interview-1", 3));
    expect(toast.success).toHaveBeenCalledWith("Đã xóa lịch phỏng vấn của Nguyễn An.");
  });

  it("shows the API reason when deleting an interview fails", async () => {
    vi.mocked(recruitmentApi.deleteInterview).mockRejectedValue(new Error("Không thể xóa lịch đã hoàn thành."));
    render(<RecruitmentInterviewsView canManage />);
    await screen.findByText("Nguyễn An");

    await userEvent.click(screen.getByRole("button", { name: "Xóa lịch phỏng vấn Nguyễn An" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xóa lịch" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Không thể xóa lịch đã hoàn thành."));
  });

  it("refreshes and explains a stale interview delete", async () => {
    const conflict = Object.assign(new Error("Interview version conflict"), { status: 409 });
    vi.mocked(recruitmentApi.deleteInterview).mockRejectedValue(conflict);
    render(<RecruitmentInterviewsView canManage />);
    await screen.findByText("Nguyễn An");
    const callsBeforeDelete = vi.mocked(recruitmentApi.listInterviews).mock.calls.length;

    await userEvent.click(screen.getByRole("button", { name: "Xóa lịch phỏng vấn Nguyễn An" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xóa lịch" }));

    await waitFor(() => expect(recruitmentApi.listInterviews).toHaveBeenCalledTimes(callsBeforeDelete + 1));
    expect(toast.error).toHaveBeenCalledWith("Không thể xóa vì lịch phỏng vấn đã được thay đổi ở nơi khác. Danh sách đã được tải lại.");
  });

  it("hides interview management actions from read-only users", async () => {
    render(<RecruitmentInterviewsView canManage={false} />);
    await screen.findByText("Nguyễn An");

    expect(screen.queryByRole("button", { name: "Lên lịch phỏng vấn" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sửa lịch phỏng vấn Nguyễn An" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Xóa lịch phỏng vấn Nguyễn An" })).toBeNull();
  });
});
