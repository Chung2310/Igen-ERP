import { useCallback, useEffect, useState } from "react";
import { workerProjectsApi } from "../api/workerProjects.api";
import type {
  WorkerProject,
  WorkerProjectInput,
  WorkerScope,
} from "../types";

export function useWorkerProjects(scope?: WorkerScope) {
  const [loading, setLoading] = useState(Boolean(scope));
  const [error, setError] = useState<string | null>(null);
  const companyCode = scope?.companyCode;
  const branchId = scope?.branchId;
  const scopeKey = companyCode ? `${companyCode}:${branchId || ""}` : "";
  const [projectState, setProjectState] = useState<{
    scopeKey: string;
    items: WorkerProject[];
  }>({ scopeKey, items: [] });
  const projects =
    projectState.scopeKey === scopeKey ? projectState.items : [];

  const reload = useCallback(async () => {
    if (!companyCode) {
      setProjectState({ scopeKey, items: [] });
      setLoading(false);
      setError(null);
      return;
    }

    const requestScope = {
      companyCode,
      ...(branchId ? { branchId } : {}),
    };
    setLoading(true);
    setError(null);
    try {
      setProjectState({
        scopeKey,
        items: await workerProjectsApi.getList(requestScope),
      });
    } catch (reason) {
      setProjectState({ scopeKey, items: [] });
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể tải danh sách dự án.",
      );
    } finally {
      setLoading(false);
    }
  }, [branchId, companyCode, scopeKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const requireScope = useCallback((): WorkerScope => {
    if (!companyCode) throw new Error("Vui lòng chọn công ty.");
    return { companyCode, ...(branchId ? { branchId } : {}) };
  }, [branchId, companyCode, scopeKey]);

  const createProject = useCallback(
    async (input: WorkerProjectInput) => {
      const project = await workerProjectsApi.create(input, requireScope());
      await reload();
      return project;
    },
    [reload, requireScope],
  );

  const updateProject = useCallback(
    async (id: string, input: Partial<WorkerProjectInput>) => {
      const project = await workerProjectsApi.update(id, input, requireScope());
      await reload();
      return project;
    },
    [reload, requireScope],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      const result = await workerProjectsApi.delete(id, requireScope());
      await reload();
      return result;
    },
    [reload, requireScope],
  );

  const addWorker = useCallback(
    async (id: string, workerId: string) => {
      const project = await workerProjectsApi.addWorker(
        id,
        workerId,
        requireScope(),
      );
      await reload();
      return project;
    },
    [reload, requireScope],
  );

  const removeWorker = useCallback(
    async (id: string, workerId: string) => {
      const project = await workerProjectsApi.removeWorker(
        id,
        workerId,
        requireScope(),
      );
      await reload();
      return project;
    },
    [reload, requireScope],
  );

  return {
    projects,
    loading,
    error,
    createProject,
    updateProject,
    deleteProject,
    addWorker,
    removeWorker,
    reload,
  };
}
