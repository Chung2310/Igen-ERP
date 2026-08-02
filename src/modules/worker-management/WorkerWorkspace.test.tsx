// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkerWorkspace from "./WorkerWorkspace";

vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: { role: "admin", companyCode: "LABOR", permissions: ["worker:read", "worker:manage"] } }) }));
vi.mock("../../hooks/useSubTabRouter", () => ({ useSubTabRouter: (_routes: unknown, initial: string) => [initial, vi.fn()] }));
vi.mock("../student-management/hooks/useAdminCenters", () => ({ useAdminCenters: () => ({ centers: [] }) }));
vi.mock("../student-management/hooks/useStudents", () => ({ useStudents: () => ({ students: [] }) }));
vi.mock("../student-management/hooks/entityPresetStore", () => ({ setEntityPreset: vi.fn() }));
vi.mock("../student-management/lib/api", () => ({ setBusinessApiScope: vi.fn() }));
vi.mock("../student-management/pages/Dashboard/DashboardPage", () => ({ DashboardPage: () => <div>Worker dashboard content</div> }));
vi.mock("../student-management/pages/Students/StudentsPage", () => ({ StudentsPage: () => <div>Worker list content</div> }));
vi.mock("../student-management/pages/Batches/BatchesPage", () => ({ BatchesPage: () => <div>Worker project content</div> }));
vi.mock("../student-management/pages/Notifications/NotificationsPage", () => ({ NotificationsPage: () => <div>Worker notification content</div> }));

afterEach(cleanup);

describe("WorkerWorkspace", () => {
  it("keeps the full legacy worker workflow tabs in the separate worker module", async () => {
    render(<WorkerWorkspace />);
    expect(await screen.findByText("Worker dashboard content")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Tổng quan/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Dự án/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Lao động/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Thông báo/ })).toBeTruthy();
  });
});
