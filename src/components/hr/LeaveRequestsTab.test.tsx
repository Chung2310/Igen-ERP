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
  { _id: "tpl1", name: "�on xin ngh? ph�p", fileUrl: "https://cdn/x.docx", fileName: "nghi-phep.docx" },
];

function mockFetch() {
  return vi.fn(async (url: string) => {
    if (String(url).includes("hr-leave-templates")) {
      return { ok: true, json: async () => ({ data: templates }) } as any;
    }
    return { ok: true, json: async () => ({ data: [] }) } as any;
  });
}

const profile = { uid: "u1", displayName: "Nh�n vi�n A" } as any;

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

    await waitFor(() => expect(screen.getByRole("button", { name: /bi?u m?u m?u/i })).toBeTruthy());
    expect(screen.getByRole("button", { name: /n?p don/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /dang bi?u m?u m?i/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /bi?u m?u m?u/i }));
    await waitFor(() => expect(screen.getByText("�on xin ngh? ph�p")).toBeTruthy());
    // Nh�n vi�n t?i du?c m?u nhung kh�ng x�a du?c.
    expect(screen.getByRole("link", { name: /t?i m?u/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^x�a$/i })).toBeNull();
  });

  it("opens the submit form when clicking N?p don", async () => {
    render(
      <LeaveRequestsTab userProfile={profile} selectedCompanyCode="IGEN" usersList={[profile]} />
    );

    await waitFor(() => expect(screen.getByRole("button", { name: /n?p don/i })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /n?p don/i }));

    expect(screen.getByText("N?p don t?")).toBeTruthy();
    // Nh�n vi�n thu?ng kh�ng ch?n du?c ngu?i kh�c.
    expect(screen.queryByText("Nh�n s?")).toBeNull();
  });

  it("gives an approver the upload, delete and employee-select affordances", async () => {
    render(
      <LeaveRequestsTab userProfile={profile} selectedCompanyCode="IGEN" canApprove usersList={[profile]} />
    );

    await waitFor(() => expect(screen.getByRole("button", { name: /dang bi?u m?u m?i/i })).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /bi?u m?u m?u/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^x�a$/i })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /d�ng/i }));

    fireEvent.click(screen.getByRole("button", { name: /^n?p don$/i }));
    const dialog = screen.getByText("N?p don t?").closest("div")!.parentElement!;
    expect(within(dialog).getByText("Nh�n s?")).toBeTruthy();
  });
});
