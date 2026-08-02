// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import WorkerManagementTab from "./WorkerManagementTab";
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    userProfile: {
      role: "admin",
      companyCode: "LABOR",
      permissions: ["worker:read", "worker:manage"],
    },
  }),
}));
vi.mock("../../hooks/useSubTabRouter", () => ({
  useSubTabRouter: (_routes: unknown, initial: string) => [initial, vi.fn()],
}));
vi.mock("./hooks/useAdminCenters", () => ({
  useAdminCenters: () => ({ centers: [] }),
}));
vi.mock("./hooks/useStudents", () => ({
  useStudents: () => ({ students: [] }),
}));
vi.mock("./pages/Dashboard/DashboardPage", () => ({
  DashboardPage: () => <div>Nội dung tổng quan lao động</div>,
}));
vi.mock("./pages/Students/StudentsPage", () => ({
  StudentsPage: () => <div>Danh sách lao động</div>,
}));
vi.mock("./pages/Batches/BatchesPage", () => ({
  BatchesPage: () => <div>Dự án lao động</div>,
}));
vi.mock("./pages/Notifications/NotificationsPage", () => ({
  NotificationsPage: () => <div>Thông báo lao động</div>,
}));
afterEach(cleanup);

it("renders the complete legacy workflow from the isolated Worker module", async () => {
  render(<WorkerManagementTab />);
  expect(await screen.findByText("Nội dung tổng quan lao động")).toBeTruthy();
  expect(screen.getByText("Dự án")).toBeTruthy();
  expect(screen.getByText("Lao động")).toBeTruthy();
  expect(screen.getByText("Thông báo")).toBeTruthy();
});
