// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
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

const pageOf = (items: (typeof project)[]) => ({ data: items, total: items.length, page: 1, limit: 10 });

afterEach(() => vi.clearAllMocks());

describe("useWorkerProjects", () => {
  it("propagates company and branch scope through every operation", async () => {
    const scope = { companyCode: "ACME", branchId: "branch-1" };
    api.workerProjectsApi.getList.mockResolvedValue(pageOf([project]));
    api.workerProjectsApi.create.mockResolvedValue(project);
    api.workerProjectsApi.update.mockResolvedValue(project);
    api.workerProjectsApi.delete.mockResolvedValue({ message: "ok" });
    api.workerProjectsApi.addWorker.mockResolvedValue(project);
    api.workerProjectsApi.removeWorker.mockResolvedValue(project);

    const { result } = renderHook(() => useWorkerProjects(scope));
    await waitFor(() =>
      expect(api.workerProjectsApi.getList).toHaveBeenCalledWith(scope, expect.objectContaining({ page: 1, limit: 10 })),
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
        if (scope.companyCode === "COMPANY-A") return pageOf([project]);
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

  it("ignores a stale project response after the company changes", async () => {
    const companyBProject = { ...project, _id: "project-b", code: "B" };
    let resolveCompanyA!: (response: ReturnType<typeof pageOf>) => void;
    const companyARequest = new Promise<ReturnType<typeof pageOf>>((resolve) => {
      resolveCompanyA = resolve;
    });
    api.workerProjectsApi.getList.mockImplementation(
      (scope: { companyCode: string }) =>
        scope.companyCode === "COMPANY-A"
          ? companyARequest
          : Promise.resolve(pageOf([companyBProject])),
    );
    const { result, rerender } = renderHook(
      ({ scope }) => useWorkerProjects(scope),
      { initialProps: { scope: { companyCode: "COMPANY-A" } } },
    );
    await waitFor(() =>
      expect(api.workerProjectsApi.getList).toHaveBeenCalledWith({
        companyCode: "COMPANY-A",
      }, expect.objectContaining({ page: 1, limit: 10 })),
    );

    rerender({ scope: { companyCode: "COMPANY-B" } });
    await waitFor(() =>
      expect(result.current.projects).toEqual([companyBProject]),
    );

    await act(async () => resolveCompanyA(pageOf([project])));

    expect(result.current.projects).toEqual([companyBProject]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("ignores a stale project error after the company changes", async () => {
    const companyBProject = { ...project, _id: "project-b", code: "B" };
    let rejectCompanyA!: (reason: Error) => void;
    const companyARequest = new Promise<ReturnType<typeof pageOf>>((_, reject) => {
      rejectCompanyA = reject;
    });
    api.workerProjectsApi.getList.mockImplementation(
      (scope: { companyCode: string }) =>
        scope.companyCode === "COMPANY-A"
          ? companyARequest
          : Promise.resolve(pageOf([companyBProject])),
    );
    const { result, rerender } = renderHook(
      ({ scope }) => useWorkerProjects(scope),
      { initialProps: { scope: { companyCode: "COMPANY-A" } } },
    );
    await waitFor(() =>
      expect(api.workerProjectsApi.getList).toHaveBeenCalledWith({
        companyCode: "COMPANY-A",
      }, expect.objectContaining({ page: 1, limit: 10 })),
    );

    rerender({ scope: { companyCode: "COMPANY-B" } });
    await waitFor(() =>
      expect(result.current.projects).toEqual([companyBProject]),
    );

    await act(async () => rejectCompanyA(new Error("Company A failed")));

    expect(result.current.projects).toEqual([companyBProject]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
