// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CompanyWorkCalendarTab from "./CompanyWorkCalendarTab";

vi.mock("../../pages/Toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe("CompanyWorkCalendarTab", () => {
  beforeEach(() => {
    localStorage.setItem("accessToken", "token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [
      { _id: "1", date: "2026-04-30", name: "Ngày Chiến thắng", dayType: "holiday", source: "system", sourceYear: 2026, isApplied: true },
    ] }) }));
  });

  it("shows generated days as system-owned and exposes the apply control", async () => {
    render(<CompanyWorkCalendarTab />);
    await waitFor(() => expect(screen.getByText("Ngày Chiến thắng")).toBeTruthy());
    expect(screen.getByText("Hệ thống")).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "Áp dụng Ngày Chiến thắng" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByRole("button", { name: "Sửa Ngày Chiến thắng" })).toBeNull();
  });
});
