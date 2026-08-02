// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkerWorkspace from "./WorkerWorkspace";

vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: { role: "admin", companyCode: "LABOR", permissions: ["worker:read", "worker:manage"] } }) }));
vi.mock("../../hooks/useSubTabRouter", () => ({ useSubTabRouter: (_routes: unknown, initial: string) => [initial, vi.fn()] }));
vi.mock("../shared-management/runtime", () => ({
  useAdminCenters: () => ({ centers: [] }),
  useStudents: () => ({ students: [] }),
  setEntityPreset: vi.fn(),
  setBusinessApiScope: vi.fn(),
}));
vi.mock("../shared-management/components", () => ({
  AddBusinessRecordModal: () => null,
  BusinessRecordDetailModal: () => null,
}));
vi.mock("../shared-management/pages/DashboardPage", () => ({ DashboardPage: () => <div>Worker dashboard content</div> }));
vi.mock("../shared-management/pages/RecordsPage", () => ({ RecordsPage: () => <div>Worker list content</div> }));
vi.mock("../shared-management/pages/ProjectsPage", () => ({ ProjectsPage: () => <div>Worker project content</div> }));
vi.mock("../shared-management/pages/NotificationsPage", () => ({ NotificationsPage: () => <div>Worker notification content</div> }));

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
