// @vitest-environment jsdom
import React from "react";
import fs from "node:fs";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkerWorkspace from "./WorkerWorkspace";

const workspaceState = vi.hoisted(() => ({
  showWorkers: false,
  userProfile: { role: "admin", companyCode: "LABOR", permissions: ["people:read", "people:manage"] } as any,
  centers: [] as Array<{ uid: string; displayName: string }>,
  projectFetch: vi.fn().mockResolvedValue({
    data: [{ _id: "project-1", name: "Project Alpha", code: "PA" }],
  }),
  standardFields: vi.fn((..._args: unknown[]) => ({
    fields: [{ key: "phone", label: "Số điện thoại", isRequired: true, isVisible: true, isArchived: false }],
  })),
  activeBranchId: "",
}));

vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: workspaceState.userProfile }) }));
vi.mock("../../context/BranchContext", () => ({ useBranch: () => ({ activeBranchId: workspaceState.activeBranchId }) }));
vi.mock("../../hooks/useSubTabRouter", () => ({ useSubTabRouter: (routes: any[], initial: string) => [workspaceState.showWorkers ? routes.find((route) => route.slug === "lao-dong").value : initial, vi.fn()] }));
vi.mock("./workerRuntime", () => ({
  useAdminCenters: () => ({ centers: workspaceState.centers }),
  useStandardFields: (...args: unknown[]) => workspaceState.standardFields(...args),
}));
vi.mock("./api/client", () => ({
  workerApiFetch: (...args: unknown[]) => workspaceState.projectFetch(...args),
}));
vi.mock("./pages/WorkerProjectsPage", () => ({ WorkerProjectsPage: () => <div>Worker project content</div> }));
vi.mock("./pages/WorkersPage", () => ({ default: ({ projects, profileFields }: any) => <div>Worker list content; project prop: {projects?.[0]?.name}; profile prop: {profileFields?.[0]?.label}</div> }));
vi.mock("./pages/WorkerNotificationsPage", () => ({ WorkerNotificationsPage: () => <div>Worker notification content</div> }));

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
  workspaceState.showWorkers = false;
  workspaceState.userProfile = { role: "admin", companyCode: "LABOR", permissions: ["people:read", "people:manage"] };
  workspaceState.centers = [];
  workspaceState.activeBranchId = "";
});

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
  it("removes the duplicate overview and keeps operational worker tabs", async () => {
    render(<WorkerWorkspace />);
    expect(await screen.findByText("Worker project content")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Tổng quan/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Dự án/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Lao động/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Thông báo/ })).toBeTruthy();
  });

  it("supplies project options and configurable profile fields to the worker page", async () => {
    workspaceState.showWorkers = true;
    render(<WorkerWorkspace />);
    expect(await screen.findByText(/project prop: Project Alpha/)).toBeTruthy();
    expect(screen.getByText(/profile prop: Số điện thoại/)).toBeTruthy();
    expect(workspaceState.projectFetch).toHaveBeenCalledWith("/worker-management/projects", {
      params: { companyCode: "LABOR" },
    });
    expect(workspaceState.standardFields).toHaveBeenCalledWith(
      "students",
      undefined,
      "LABOR",
    );
  });

  it("uses the active branch for the worker QR registration scope", async () => {
    workspaceState.showWorkers = true;
    workspaceState.activeBranchId = "branch-selected";

    render(<WorkerWorkspace />);

    await waitFor(() => expect(workspaceState.projectFetch).toHaveBeenCalledWith(
      "/worker-management/projects",
      { params: { companyCode: "LABOR", branchId: "branch-selected" } },
    ));
  });

  it("does not expose the previous company's projects while a new scope loads", async () => {
    workspaceState.showWorkers = true;
    workspaceState.userProfile = { role: "superadmin", permissions: ["people:read", "people:manage"] };
    workspaceState.centers = [
      { uid: "COMPANY-A", displayName: "Company A" },
      { uid: "COMPANY-B", displayName: "Company B" },
    ];
    workspaceState.projectFetch.mockImplementation(async (_path, options: any) => {
      if (options.params.companyCode === "COMPANY-A") {
        return { data: [{ _id: "project-a", name: "Project A", code: "A" }] };
      }
      return new Promise(() => { });
    });

    render(<WorkerWorkspace />);
    const centerSelect = screen.getByRole("button", { name: "Chọn cơ sở lao động" });
    await userEvent.click(centerSelect);
    await userEvent.click(screen.getByRole("option", { name: "Company A" }));
    expect(await screen.findByText(/project prop: Project A/)).toBeTruthy();

    await userEvent.click(centerSelect);
    await userEvent.click(screen.getByRole("option", { name: "Company B" }));
    expect(screen.queryByText(/project prop: Project A/)).toBeNull();
  });
});
