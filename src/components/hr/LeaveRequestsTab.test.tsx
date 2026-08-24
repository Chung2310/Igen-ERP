// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor, within, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LeaveRequestsTab from "./LeaveRequestsTab";

vi.mock("../../services/authService", () => ({ getAccessToken: () => "token" }));
vi.mock("../../pages/Toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const templates = [
  { _id: "tpl1", name: "Đơn xin nghỉ phép", fileUrl: "https://cdn/x.docx", fileName: "nghi-phep.docx" },
];

const responsiveApplication = {
  _id: "app-responsive",
  employeeName: "Responsive Employee",
  requestKind: "leave",
  type: "leave",
  startDate: "2026-08-24T01:00:00.000Z",
  endDate: "2026-08-24T10:00:00.000Z",
  reason: "Responsive reason",
  uploadedFileUrl: "https://cdn/request.pdf",
  uploadedFileName: "request.pdf",
  status: "pending",
  note: "Responsive admin feedback",
};

function mockFetch(applications: any[] = []) {
  return vi.fn(async (url: string) => {
    if (String(url).includes("hr-leave-templates")) {
      return { ok: true, json: async () => ({ data: templates }) } as any;
    }
    return { ok: true, json: async () => ({ data: applications }) } as any;
  });
}

function mockViewport(useCardLayout: boolean) {
  vi.stubGlobal("matchMedia", vi.fn().mockImplementation((query: string) => ({
    matches: useCardLayout && query === "(max-width: 999px)",
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
}

const profile = { uid: "u1", displayName: "Nhân viên A" } as any;

describe("LeaveRequestsTab", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch());
    mockViewport(false);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("lets a regular employee browse templates and submit, without template upload", async () => {
    render(
      <LeaveRequestsTab userProfile={profile} selectedCompanyCode="IGEN" usersList={[profile]} />
    );

    await waitFor(() => expect(screen.getByRole("button", { name: /biểu mẫu mẫu/i })).toBeTruthy());
    expect(screen.getByRole("button", { name: /nộp đơn/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /đăng biểu mẫu mới/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /biểu mẫu mẫu/i }));
    await waitFor(() => expect(screen.getByText("Đơn xin nghỉ phép")).toBeTruthy());
    // Nhân viên tải được mẫu nhưng không xóa được.
    expect(screen.getByRole("link", { name: /tải mẫu/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^xóa$/i })).toBeNull();
  });

  it("opens the submit form when clicking Nộp đơn", async () => {
    render(
      <LeaveRequestsTab userProfile={profile} selectedCompanyCode="IGEN" usersList={[profile]} />
    );

    await waitFor(() => expect(screen.getByRole("button", { name: /nộp đơn/i })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /nộp đơn/i }));

    expect(screen.getByText("Nộp đơn từ")).toBeTruthy();
    // Nhân viên thường không chọn được người khác.
    expect(screen.queryByText("Nhân sự")).toBeNull();
  });

  it("mounts the submit modal above the app stacking context", async () => {
    render(
      <LeaveRequestsTab userProfile={profile} selectedCompanyCode="IGEN" usersList={[profile]} />
    );

    await waitFor(() => expect(screen.getByRole("button", { name: /nộp đơn/i })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /nộp đơn/i }));

    const backdrop = screen.getByTestId("leave-request-submit-modal");
    expect(backdrop.parentElement).toBe(document.body);
    expect(backdrop.className).toContain("fixed");
    expect(backdrop.className).toContain("inset-0");
    expect(backdrop.className).toContain("z-[100]");
  });

  it("gives an approver the upload, delete and employee-select affordances", async () => {
    render(
      <LeaveRequestsTab userProfile={profile} selectedCompanyCode="IGEN" canApprove usersList={[profile]} />
    );

    await waitFor(() => expect(screen.getByRole("button", { name: /đăng biểu mẫu mới/i })).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /biểu mẫu mẫu/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^xóa$/i })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /đóng/i }));

    fireEvent.click(screen.getByRole("button", { name: /^nộp đơn$/i }));
    const dialog = screen.getByText("Nộp đơn từ").closest("div")!.parentElement!;
    expect(within(dialog).getByText("Nhân sự")).toBeTruthy();
  });

  it("renders complete request cards below 1000px", async () => {
    mockViewport(true);
    vi.stubGlobal("fetch", mockFetch([responsiveApplication]));

    render(
      <LeaveRequestsTab userProfile={profile} selectedCompanyCode="IGEN" canApprove usersList={[profile]} />
    );

    await waitFor(() => expect(screen.getByText("Responsive Employee")).toBeTruthy());
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("Responsive reason")).toBeTruthy();
    expect(screen.getByText("Responsive admin feedback")).toBeTruthy();
    expect(screen.getByRole("link", { name: /minh chứng/i })).toBeTruthy();
    expect(document.querySelector('[title="Duyệt đơn"]')).toBeTruthy();
    expect(document.querySelector('[title="Từ chối"]')).toBeTruthy();
    expect(document.querySelector('[title="Xóa đơn"]')).toBeTruthy();
  });

  it("keeps the request table at 1000px and wider", async () => {
    mockViewport(false);
    vi.stubGlobal("fetch", mockFetch([responsiveApplication]));

    render(
      <LeaveRequestsTab userProfile={profile} selectedCompanyCode="IGEN" canApprove usersList={[profile]} />
    );

    await waitFor(() => expect(screen.getByText("Responsive Employee")).toBeTruthy());
    expect(screen.getByRole("table")).toBeTruthy();
  });
});
