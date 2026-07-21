// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CompanyWorkCalendarTab from "./CompanyWorkCalendarTab";

vi.mock("../../pages/Toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe("CompanyWorkCalendarTab admin rows", () => {
  it("allows editing an admin-created day", async () => {
    localStorage.setItem("accessToken", "token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [
      { _id: "2", date: "2026-06-01", name: "Nghỉ công ty", dayType: "holiday", source: "admin", sourceYear: 2026, isApplied: true },
    ] }) }));
    render(<CompanyWorkCalendarTab />);
    await waitFor(() => expect(screen.getByText("Nghỉ công ty")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Sửa Nghỉ công ty" })).toBeTruthy();
  });
});
