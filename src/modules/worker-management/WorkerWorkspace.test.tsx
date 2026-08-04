// @vitest-environment jsdom
import React from "react";
import fs from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkerWorkspace from "./WorkerWorkspace";

vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: { role: "admin", companyCode: "LABOR", permissions: ["worker:read", "worker:manage"] } }) }));
vi.mock("../../hooks/useSubTabRouter", () => ({ useSubTabRouter: (_routes: unknown, initial: string) => [initial, vi.fn()] }));
vi.mock("../shared-management/runtime", () => ({
  useAdminCenters: () => ({ centers: [] }),
  setEntityPreset: vi.fn(),
  setBusinessApiScope: vi.fn(),
}));
vi.mock("../shared-management/pages/DashboardPage", () => ({ DashboardPage: () => <div>Worker dashboard content</div> }));
vi.mock("./pages/WorkersPage", () => ({ default: () => <div>Worker list content</div> }));
vi.mock("../shared-management/pages/ProjectsPage", () => ({ ProjectsPage: () => <div>Worker project content</div> }));
vi.mock("../shared-management/pages/NotificationsPage", () => ({ NotificationsPage: () => <div>Worker notification content</div> }));

afterEach(cleanup);

describe("WorkerWorkspace", () => {
  it("does not directly import student-management", () => {
    const source = fs.readFileSync("src/modules/worker-management/WorkerWorkspace.tsx", "utf8");
    expect(source).not.toContain("../student-management/");
  });

  it("renders the worker-owned profile page instead of the shared student runtime", () => {
    const source = fs.readFileSync("src/modules/worker-management/WorkerWorkspace.tsx", "utf8");
    expect(source).not.toContain("shared-management/pages/RecordsPage");
    expect(source).not.toContain("shared-management/components");
    expect(source).toContain("./pages/WorkersPage");
  });
  it("keeps the full legacy worker workflow tabs in the separate worker module", async () => {
    render(<WorkerWorkspace />);
    expect(await screen.findByText("Worker dashboard content")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Tổng quan/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Dự án/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Lao động/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Thông báo/ })).toBeTruthy();
  });
});
