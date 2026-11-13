// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("confirms deletion of an admin-created substitute holiday and removes it from the table", async () => {
    localStorage.setItem("accessToken", "token");
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => ({
      ok: true,
      json: async () => ({ data: options?.method === "DELETE" ? { _id: "507f1f77bcf86cd799439011" } : [
        { _id: "507f1f77bcf86cd799439011", date: "2026-01-08", name: "Nghỉ bù", dayType: "substitute_holiday", source: "admin", sourceYear: 2026, isApplied: true },
        { _id: "507f1f77bcf86cd799439012", date: "2026-01-01", name: "Tết Dương lịch", dayType: "holiday", source: "system", sourceYear: 2026, isApplied: true },
      ] }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<CompanyWorkCalendarTab />);
    await screen.findByText("Nghỉ bù");

    expect(screen.queryByRole("button", { name: /Xóa Tết Dương lịch/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Xóa Nghỉ bù ngày 08/01/2026" }));
    expect(screen.getByRole("alertdialog", { name: "Xóa ngày khỏi lịch công ty?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(fetchMock).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: "DELETE" }));

    fireEvent.click(screen.getByRole("button", { name: "Xóa Nghỉ bù ngày 08/01/2026" }));
    fireEvent.click(screen.getByRole("button", { name: "Xóa ngày" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/timekeeping/work-calendar/507f1f77bcf86cd799439011",
      expect.objectContaining({ method: "DELETE" }),
    ));
    await waitFor(() => expect(screen.queryByText("Nghỉ bù")).toBeNull());
    expect(screen.getByText("Tết Dương lịch")).toBeTruthy();
  });
});
