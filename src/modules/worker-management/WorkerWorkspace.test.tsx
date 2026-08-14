// @vitest-environment jsdom
import React from "react";
import fs from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkerWorkspace from "./WorkerWorkspace";
import { toast } from "../../pages/Toast";

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
  workerUpdate: vi.fn().mockImplementation(async (_id, input) => ({ _id: "worker-1", ...input })),
  workerHookUpdate: vi.fn().mockImplementation(async (_id, input) => ({ _id: "worker-1", ...input })),
}));

vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: workspaceState.userProfile }) }));
vi.mock("../../hooks/useSubTabRouter", () => ({ useSubTabRouter: (routes: any[], initial: string) => [workspaceState.showWorkers ? routes.find((route) => route.slug === "lao-dong").value : initial, vi.fn()] }));
vi.mock("./workerRuntime", () => ({
  useAdminCenters: () => ({ centers: workspaceState.centers }),
  useStandardFields: (...args: unknown[]) => workspaceState.standardFields(...args),
}));
vi.mock("./api/client", () => ({
  workerApiFetch: (...args: unknown[]) => workspaceState.projectFetch(...args),
}));
vi.mock("./api/workers.api", () => ({
  workerApi: { update: (...args: unknown[]) => workspaceState.workerUpdate(...args) },
}));
vi.mock("./hooks/useWorkers", () => ({
  useWorkers: () => ({
    workers: [
      { _id: "worker-1", fullName: "Nguyen Van A", phone: "0901", status: "active" },
      { _id: "worker-2", fullName: "Other Worker", phone: "0902", status: "active" },
    ],
    updateWorker: (...args: unknown[]) => workspaceState.workerHookUpdate(...args),
  }),
}));
vi.mock("./pages/WorkerDashboardPage", () => ({
  WorkerDashboardPage: ({ onSelectStudent }: { onSelectStudent: (worker: object) => void }) => (
    <div>
      Worker dashboard content
      <button
        type="button"
        onClick={() => onSelectStudent({
          _id: "worker-1",
          fullName: "Nguyễn Văn A",
          phone: "0901",
          status: "active",
        })}
      >
        Open dashboard worker
      </button>
    </div>
  ),
}));
vi.mock("./pages/WorkersPage", () => ({ default: ({ projects, profileFields }: any) => <div>Worker list content; project prop: {projects?.[0]?.name}; profile prop: {profileFields?.[0]?.label}</div> }));
vi.mock("./pages/WorkerNotificationsPage", () => ({ WorkerNotificationsPage: () => <div>Worker notification content</div> }));

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
  workspaceState.showWorkers = false;
  workspaceState.userProfile = { role: "admin", companyCode: "LABOR", permissions: ["people:read", "people:manage"] };
  workspaceState.centers = [];
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
  it("keeps the full legacy worker workflow tabs in the separate worker module", async () => {
    render(<WorkerWorkspace />);
    expect(await screen.findByText("Worker dashboard content")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Tổng quan/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Dự án/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Lao động/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Thông báo/ })).toBeTruthy();
  });

  it("opens worker profile detail from a dashboard selection", async () => {
    render(<WorkerWorkspace />);
    await userEvent.click(await screen.findByRole("button", { name: "Open dashboard worker" }));
    expect(screen.getByRole("heading", { name: "Nguyễn Văn A" })).toBeTruthy();
  });

  it("supplies project options and configurable profile fields to the worker page", async () => {
    workspaceState.showWorkers = true;
    render(<WorkerWorkspace />);
    expect(await screen.findByText(/project prop: Project Alpha/)).toBeTruthy();
    expect(screen.getByText(/profile prop: Runtime phone/)).toBeTruthy();
    expect(workspaceState.projectFetch).toHaveBeenCalledWith("/worker-management/projects", {
      params: { companyCode: "LABOR" },
    });
    expect(workspaceState.standardFields).toHaveBeenCalledWith(
      "students",
      undefined,
      "LABOR",
    );
  });

  it("validates a dashboard-opened worker against runtime profile data", async () => {
    const errorToast = vi.spyOn(toast, "error");
    render(<WorkerWorkspace />);
    await userEvent.click(await screen.findByRole("button", { name: "Open dashboard worker" }));
    const modal = document.querySelector(".fixed.z-\\[60\\]") as HTMLElement;
    await userEvent.click(modal.querySelector(".border-b button") as HTMLElement);
    fireEvent.change(modal.querySelector('input[name="phone"]') as HTMLInputElement, {
      target: { value: "0902" },
    });
    fireEvent.submit(modal.querySelector("form") as HTMLFormElement);
    expect(errorToast).toHaveBeenCalledWith(expect.stringContaining("đã tồn tại"));
    expect(workspaceState.workerHookUpdate).not.toHaveBeenCalled();
    expect(workspaceState.workerUpdate).not.toHaveBeenCalled();
  });

  it("reloads worker data through the worker hook after a dashboard edit", async () => {
    render(<WorkerWorkspace />);
    await userEvent.click(await screen.findByRole("button", { name: "Open dashboard worker" }));
    const modal = document.querySelector(".fixed.z-\\[60\\]") as HTMLElement;
    await userEvent.click(modal.querySelector(".border-b button") as HTMLElement);
    fireEvent.change(modal.querySelector('input[name="fullName"]') as HTMLInputElement, {
      target: { value: "Nguyễn Văn B" },
    });
    fireEvent.submit(modal.querySelector("form") as HTMLFormElement);
    await waitFor(() => expect(workspaceState.workerHookUpdate).toHaveBeenCalled());
    expect(workspaceState.workerUpdate).not.toHaveBeenCalled();
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
    const centerSelect = screen.getByRole("combobox");
    fireEvent.change(centerSelect, { target: { value: "COMPANY-A" } });
    expect(await screen.findByText(/project prop: Project A/)).toBeTruthy();

    fireEvent.change(centerSelect, { target: { value: "COMPANY-B" } });
    expect(screen.queryByText(/project prop: Project A/)).toBeNull();
  });
});
