// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const { dashboard, notifications } = vi.hoisted(() => ({ dashboard: { get: vi.fn() }, notifications: { list: vi.fn(), create: vi.fn() } }));
vi.mock("../api/workerDashboard.api", () => ({ workerDashboardApi: dashboard }));
vi.mock("../api/workerNotifications.api", () => ({ workerNotificationsApi: notifications }));
import { WorkerDashboardPage } from "./WorkerDashboardPage";
import { WorkerNotificationsPage } from "./WorkerNotificationsPage";

describe("worker dashboard and notification pages", () => {
  it("renders dashboard stats from worker API", async () => { dashboard.get.mockResolvedValue({ totalWorkers: 4, activeWorkers: 3, projects: 2 }); render(<WorkerDashboardPage formattedDate="today" selectedCenter="ACME" />); expect(await screen.findByText("4")).toBeTruthy(); expect(screen.getByText("3")).toBeTruthy(); });
  it("creates a notification and refreshes the list", async () => { notifications.list.mockResolvedValue([]); notifications.create.mockResolvedValue({}); render(<WorkerNotificationsPage />); await screen.findByText("Chưa có thông báo."); fireEvent.change(screen.getByLabelText("Tiêu đề"), { target: { value: "Shift" } }); fireEvent.change(screen.getByLabelText("Nội dung"), { target: { value: "Starts at 8" } }); fireEvent.click(screen.getByRole("button", { name: "Gửi thông báo" })); await waitFor(() => expect(notifications.create).toHaveBeenCalledWith({ title: "Shift", content: "Starts at 8" })); });
});
