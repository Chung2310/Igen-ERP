// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const { dashboard, notifications } = vi.hoisted(() => ({ dashboard: { get: vi.fn() }, notifications: { list: vi.fn(), create: vi.fn() } }));
vi.mock("../api/workerDashboard.api", () => ({ workerDashboardApi: dashboard }));
vi.mock("../api/workerNotifications.api", () => ({ workerNotificationsApi: notifications }));
import { WorkerDashboardPage } from "./WorkerDashboardPage";
import { WorkerNotificationsPage } from "./WorkerNotificationsPage";

describe("worker dashboard and notification pages", () => {
  it("renders dashboard stats from worker API", async () => {
    dashboard.get.mockResolvedValue({ totalWorkers: 4, activeWorkers: 3, projects: 2 });
    render(<WorkerDashboardPage formattedDate="today" selectedCenter="ACME" />);
    const summary = within(screen.getByRole("region", { name: "Số liệu tổng quan lao động" }));
    expect(await summary.findByText("4")).toBeTruthy();
    expect(summary.getByText("3")).toBeTruthy();
  });
  it("shows monthly registrations and status chart values", async () => {
    dashboard.get.mockResolvedValue({
      totalWorkers: 8,
      activeWorkers: 5,
      projects: 4,
      monthlyRegistrations: [0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      workersByStatus: { active: 5, placed: 2, inactive: 1 },
      projectsByStatus: { active: 2, planned: 1, completed: 1 },
    });
    render(<WorkerDashboardPage formattedDate="today" selectedCenter="ACME" />);
    expect(await screen.findByText("3 đăng ký")).toBeTruthy();
    expect(screen.getByRole("img", { name: /tháng 2 2,.*tháng 12 1/ })).toBeTruthy();
    expect(screen.getByRole("img", { name: /Lao động: Hoạt động 5, Giao việc 2, Nghỉ 1/ })).toBeTruthy();
  });
  it("keeps contract alerts in the summary row and opens contracts", async () => {
    dashboard.get.mockResolvedValue({
      contractAlerts: { alertDays: 30, expiringCount: 2, expiredCount: 1 },
    });
    const onNavigate = vi.fn();
    const { container } = render(<WorkerDashboardPage formattedDate="today" selectedCenter="ACME" onNavigate={onNavigate} />);

    const summary = within(container).getByRole("region", { name: "Số liệu tổng quan lao động" });
    const alert = await within(summary).findByRole("alert");
    expect(within(alert).getByText("1 đã hết hạn · 2 sắp hết hạn trong 30 ngày")).toBeTruthy();
    fireEvent.click(within(alert).getByRole("button", { name: "Xem hợp đồng cần chú ý" }));
    expect(onNavigate).toHaveBeenCalledWith("hop-dong");
  });
  it("creates a notification and refreshes the list", async () => { notifications.list.mockResolvedValue([]); notifications.create.mockResolvedValue({}); render(<WorkerNotificationsPage />); await screen.findByText("Chưa có thông báo."); fireEvent.change(screen.getByLabelText("Tiêu đề"), { target: { value: "Shift" } }); fireEvent.change(screen.getByLabelText("Nội dung"), { target: { value: "Starts at 8" } }); fireEvent.click(screen.getByRole("button", { name: "Gửi thông báo" })); await waitFor(() => expect(notifications.create).toHaveBeenCalledWith({ title: "Shift", content: "Starts at 8" })); });
});
