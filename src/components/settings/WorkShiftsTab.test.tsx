// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkShiftsTab from "./WorkShiftsTab";

vi.mock("../../pages/Toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

afterEach(() => vi.unstubAllGlobals());

describe("chọn nhanh nhân viên để phân ca", () => {
  it("chọn giờ theo định dạng 24 giờ trong popup thêm ca", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [] }),
    })));

    render(<WorkShiftsTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Thêm ca" }));
    const startTime = screen.getByRole("button", { name: "Giờ bắt đầu" });
    fireEvent.click(startTime);
    fireEvent.click(screen.getByRole("button", { name: "Giờ 09" }));
    fireEvent.click(screen.getByRole("button", { name: "Phút 30" }));
    expect(startTime.textContent).toContain("09:30");
  });

  it("chọn tất cả hoặc chỉ nhân viên chưa có ca", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
      ok: true,
      json: async () => ({ data: url.includes("shift-assignments") ? [
        { _id: "a", displayName: "An", email: "an@example.com" },
        { _id: "b", displayName: "Bình", email: "binh@example.com", assignment: { shiftId: "shift-1", effectiveFrom: "2026-11-01", daysOfWeek: [1] } },
        { _id: "c", displayName: "Chi", email: "chi@example.com" },
      ] : [{ _id: "shift-1", name: "Ca sáng", isActive: true }] }),
    })));

    render(<WorkShiftsTab />);
    const selectAll = await screen.findByRole("button", { name: "Chọn tất cả (3)" });
    const checkbox = (name: string) => screen.getByRole("checkbox", { name: new RegExp(name) }) as HTMLInputElement;

    fireEvent.click(screen.getByRole("button", { name: "Chọn chưa có ca (2)" }));
    await waitFor(() => {
      expect(checkbox("An").checked).toBe(true);
      expect(checkbox("Bình").checked).toBe(false);
      expect(checkbox("Chi").checked).toBe(true);
    });

    fireEvent.click(selectAll);
    expect(checkbox("Bình").checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ chọn" }));
    expect(checkbox("An").checked).toBe(false);
    expect(checkbox("Bình").checked).toBe(false);
    expect(checkbox("Chi").checked).toBe(false);
  });
});
