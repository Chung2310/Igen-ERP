// @vitest-environment jsdom
import React from "react";
import fs from "node:fs";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const projectHooks = vi.hoisted(() => ({ useWorkerProjects: vi.fn() }));
const workerHooks = vi.hoisted(() => ({ useWorkers: vi.fn() }));
vi.mock("../hooks/useWorkerProjects", () => projectHooks);
vi.mock("../hooks/useWorkers", () => workerHooks);

import { workerProjectsApi } from "../api/workerProjects.api";
import { WorkerProjectsPage } from "./WorkerProjectsPage";

const project = {
  _id: "project-1",
  code: "P-1",
  name: "Project One",
  quota: 10,
  workerIds: ["worker-1"],
  daysOfWeek: [1, 3],
  startTime: "08:00",
  endTime: "17:00",
  location: "Site A",
  startDate: "2026-08-01",
  endDate: "2026-09-01",
  status: "planned" as const,
};

const projectState = (overrides: Record<string, unknown> = {}) => ({
  projects: [project],
  loading: false,
  error: null,
  createProject: vi.fn().mockResolvedValue(project),
  updateProject: vi.fn().mockResolvedValue(project),
  deleteProject: vi.fn().mockResolvedValue(undefined),
  addWorker: vi.fn().mockResolvedValue(project),
  removeWorker: vi.fn().mockResolvedValue(project),
  reload: vi.fn(),
  ...overrides,
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  localStorage.clear();
});

beforeEach(() => {
  projectHooks.useWorkerProjects.mockReturnValue(projectState());
  workerHooks.useWorkers.mockReturnValue({
    workers: [
      { _id: "worker-1", fullName: "Worker One", status: "active" },
      { _id: "worker-2", fullName: "Worker Two", status: "active" },
    ],
    loading: false,
    error: null,
  });
});

describe("worker project ownership", () => {
  it("uses direct scoped worker-project URLs for every operation", async () => {
    localStorage.setItem("accessToken", "worker-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      }),
    );
    const scope = { companyCode: "ACME", branchId: "branch-1" };
    const input = {
      code: "P-1",
      name: "Project One",
      quota: 10,
      workerIds: [],
      daysOfWeek: [],
      startTime: "08:00",
      endTime: "17:00",
      startDate: "",
      endDate: "",
      status: "planned" as const,
    };

    await workerProjectsApi.getList(scope);
    await workerProjectsApi.create(input, scope);
    await workerProjectsApi.update("project-1", input, scope);
    await workerProjectsApi.delete("project-1", scope);
    await workerProjectsApi.addWorker("project-1", "worker-1", scope);
    await workerProjectsApi.removeWorker("project-1", "worker-1", scope);

    const calls = vi.mocked(fetch).mock.calls;
    expect(calls).toHaveLength(6);
    for (const [url] of calls) {
      expect(String(url)).toContain("/api/v1/worker-management/projects");
      expect(String(url)).toContain("companyCode=ACME");
      expect(String(url)).toContain("branchId=branch-1");
      expect(String(url)).not.toContain("/batches");
    }
    const headers = (calls[0][1] as RequestInit).headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer worker-token");
  });

  it("wires the workspace to a worker-owned project page and hook", () => {
    const workspace = fs.readFileSync(
      "src/modules/worker-management/WorkerWorkspace.tsx",
      "utf8",
    );
    const pagePath =
      "src/modules/worker-management/pages/WorkerProjectsPage.tsx";
    const hookPath =
      "src/modules/worker-management/hooks/useWorkerProjects.ts";

    expect(fs.existsSync(pagePath)).toBe(true);
    expect(fs.existsSync(hookPath)).toBe(true);
    expect(workspace).toContain("./pages/WorkerProjectsPage");
    expect(workspace).not.toContain("shared-management/pages/ProjectsPage");
    const page = fs.readFileSync(pagePath, "utf8");
    expect(page).not.toContain("student-management");
    expect(page).not.toContain("useBatches");
    expect(page).not.toContain("/batches");
  });

  it("preserves scoped table/card views, project actions, and status labels", async () => {
    const { container } = render(
      <WorkerProjectsPage selectedCenter="ACME" branchId="branch-1" />,
    );

    expect(projectHooks.useWorkerProjects).toHaveBeenCalledWith({
      companyCode: "ACME",
      branchId: "branch-1",
    });
    expect(workerHooks.useWorkers).toHaveBeenCalledWith({
      companyCode: "ACME",
      branchId: "branch-1",
    });
    expect(screen.getByText("Project One")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Sắp triển khai" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Đang triển khai" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Đã kết thúc" })).toBeTruthy();
    expect(screen.getByTitle("Chỉnh sửa dự án")).toBeTruthy();
    expect(screen.getByTitle("Xóa dự án")).toBeTruthy();
    expect(screen.getByTitle("Quản lý lao động")).toBeTruthy();

    await userEvent.click(screen.getByTitle("Dạng thẻ"));
    expect(container.querySelector(".project-cards")).toBeTruthy();
    await userEvent.click(screen.getByTitle("Dạng bảng"));
    expect(container.querySelector("table")).toBeTruthy();
  });

  it("creates, edits, changes status, and deletes through the worker hook", async () => {
    const hookValue = projectState();
    projectHooks.useWorkerProjects.mockReturnValue(hookValue);
    render(<WorkerProjectsPage selectedCenter="ACME" />);

    await userEvent.click(screen.getByRole("button", { name: "Thêm dự án" }));
    await userEvent.type(screen.getByLabelText("Mã dự án"), "P-2");
    await userEvent.type(screen.getByLabelText("Tên dự án"), "Project Two");
    await userEvent.click(screen.getByRole("button", { name: "Tạo dự án" }));
    await waitFor(() =>
      expect(hookValue.createProject).toHaveBeenCalledWith(
        expect.objectContaining({ code: "P-2", name: "Project Two" }),
      ),
    );

    await userEvent.click(screen.getByTitle("Chỉnh sửa dự án"));
    fireEvent.change(screen.getByLabelText("Tên dự án"), {
      target: { value: "Project One Updated" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Cập nhật dự án" }));
    await waitFor(() =>
      expect(hookValue.updateProject).toHaveBeenCalledWith(
        "project-1",
        expect.objectContaining({ name: "Project One Updated" }),
      ),
    );

    fireEvent.change(screen.getByLabelText("Trạng thái P-1"), {
      target: { value: "active" },
    });
    await waitFor(() =>
      expect(hookValue.updateProject).toHaveBeenCalledWith(
        "project-1",
        expect.objectContaining({ status: "active" }),
      ),
    );

    await userEvent.click(screen.getByTitle("Xóa dự án"));
    await userEvent.click(screen.getByRole("button", { name: "Xóa" }));
    await waitFor(() =>
      expect(hookValue.deleteProject).toHaveBeenCalledWith("project-1"),
    );
  });

  it("adds and removes scoped workers through the membership actions", async () => {
    const hookValue = projectState();
    projectHooks.useWorkerProjects.mockReturnValue(hookValue);
    render(<WorkerProjectsPage selectedCenter="ACME" />);

    await userEvent.click(screen.getByTitle("Quản lý lao động"));
    await userEvent.selectOptions(screen.getByLabelText("Thêm lao động"), "worker-2");
    await userEvent.click(screen.getByRole("button", { name: "Thêm vào dự án" }));
    await waitFor(() =>
      expect(hookValue.addWorker).toHaveBeenCalledWith("project-1", "worker-2"),
    );

    await userEvent.click(screen.getByTitle("Gỡ Worker One khỏi dự án"));
    await waitFor(() =>
      expect(hookValue.removeWorker).toHaveBeenCalledWith(
        "project-1",
        "worker-1",
      ),
    );
  });
});
