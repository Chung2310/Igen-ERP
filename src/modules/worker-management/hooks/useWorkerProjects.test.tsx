// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  workerProjectsApi: {
    getList: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addWorker: vi.fn(),
    removeWorker: vi.fn(),
  },
}));

vi.mock("../api/workerProjects.api", () => api);

import { useWorkerProjects } from "./useWorkerProjects";

const project = {
  _id: "project-a",
  code: "A",
  name: "Project A",
  quota: 1,
  workerIds: [],
  daysOfWeek: [],
  startTime: "08:00",
  endTime: "17:00",
  startDate: "",
  endDate: "",
  status: "planned" as const,
};

afterEach(() => vi.clearAllMocks());

describe("useWorkerProjects", () => {
  it("propagates company and branch scope through every operation", async () => {
    const scope = { companyCode: "ACME", branchId: "branch-1" };
    api.workerProjectsApi.getList.mockResolvedValue([project]);
    api.workerProjectsApi.create.mockResolvedValue(project);
    api.workerProjectsApi.update.mockResolvedValue(project);
    api.workerProjectsApi.delete.mockResolvedValue({ message: "ok" });
    api.workerProjectsApi.addWorker.mockResolvedValue(project);
    api.workerProjectsApi.removeWorker.mockResolvedValue(project);

    const { result } = renderHook(() => useWorkerProjects(scope));
    await waitFor(() =>
      expect(api.workerProjectsApi.getList).toHaveBeenCalledWith(scope),
    );
    await result.current.createProject(project);
    await result.current.updateProject(project._id, { name: "Updated" });
    await result.current.deleteProject(project._id);
    await result.current.addWorker(project._id, "worker-1");
    await result.current.removeWorker(project._id, "worker-1");

    expect(api.workerProjectsApi.create).toHaveBeenCalledWith(project, scope);
    expect(api.workerProjectsApi.update).toHaveBeenCalledWith(
      project._id,
      { name: "Updated" },
      scope,
    );
    expect(api.workerProjectsApi.delete).toHaveBeenCalledWith(
      project._id,
      scope,
    );
    expect(api.workerProjectsApi.addWorker).toHaveBeenCalledWith(
      project._id,
      "worker-1",
      scope,
    );
    expect(api.workerProjectsApi.removeWorker).toHaveBeenCalledWith(
      project._id,
      "worker-1",
      scope,
    );
  });

  it("hides the previous company projects immediately when scope changes", async () => {
    api.workerProjectsApi.getList.mockImplementation(
      async (scope: { companyCode: string }) => {
        if (scope.companyCode === "COMPANY-A") return [project];
        return new Promise(() => {});
      },
    );
    const { result, rerender } = renderHook(
      ({ scope }) => useWorkerProjects(scope),
      { initialProps: { scope: { companyCode: "COMPANY-A" } } },
    );
    await waitFor(() => expect(result.current.projects).toEqual([project]));

    rerender({ scope: { companyCode: "COMPANY-B" } });

    expect(result.current.projects).toEqual([]);
  });
});
