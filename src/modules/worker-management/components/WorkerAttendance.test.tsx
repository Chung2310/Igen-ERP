// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const { attendance } = vi.hoisted(() => ({ attendance: { list: vi.fn(), mark: vi.fn(), createQrSession: vi.fn(), getQrToken: vi.fn(), getQrStatus: vi.fn(), closeQrSession: vi.fn() } }));
vi.mock("../api/workerAttendance.api", () => ({ workerAttendanceApi: attendance }));
import { WorkerTimekeepingPanel } from "./WorkerTimekeepingPanel";
import { WorkerQrAttendance } from "./WorkerQrAttendance";

describe("worker attendance components", () => {
  it("loads workers and marks attendance", async () => {
    attendance.list.mockResolvedValue([]); attendance.mark.mockResolvedValue({});
    render(<WorkerTimekeepingPanel projectId="p1" workers={[{ _id: "w1", fullName: "Worker One", status: "active" }]} />);
    expect(await screen.findByText("Worker One")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Check-in" }));
    await waitFor(() => expect(attendance.mark).toHaveBeenCalledWith({ projectId: "p1", workerId: "w1" }));
  });
  it("creates and closes a QR session", async () => {
    attendance.createQrSession.mockResolvedValue({ id: "s1", expiresAt: Date.now() + 60_000 });
    attendance.getQrToken.mockResolvedValue({ token: "t1" }); attendance.closeQrSession.mockResolvedValue({});
    render(<WorkerQrAttendance projectId="p1" date="2026-08-05" />);
    fireEvent.click(screen.getByRole("button", { name: "Tạo phiên QR" }));
    // Liên kết hiện ngay cạnh mã QR để quản lý mở thử trên tab ẩn danh.
    expect(await screen.findByText(new RegExp("/worker/checkin/t1$"))).toBeTruthy();
    expect(screen.getByRole("link", { name: "Mở tab mới" }).getAttribute("href")).toMatch(/\/worker\/checkin\/t1$/);
    fireEvent.click(screen.getByRole("button", { name: "Đóng phiên" }));
    await waitFor(() => expect(attendance.closeQrSession).toHaveBeenCalledWith("s1"));
  });
});
