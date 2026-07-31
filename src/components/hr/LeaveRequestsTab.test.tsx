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

function mockFetch() {
  return vi.fn(async (url: string) => {
    if (String(url).includes("hr-leave-templates")) {
      return { ok: true, json: async () => ({ data: templates }) } as any;
    }
    return { ok: true, json: async () => ({ data: [] }) } as any;
  });
}

const profile = { uid: "u1", displayName: "Nhân viên A" } as any;

describe("LeaveRequestsTab", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch());
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
});
