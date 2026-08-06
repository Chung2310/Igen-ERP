import { useCallback, useEffect, useState } from "react";
import { workerApi } from "../api/workers.api";
import type { BulkWorkerInput, Worker, WorkerInput, WorkerScope } from "../types";

export function useWorkers(scope?: WorkerScope) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(Boolean(scope));
  const [error, setError] = useState<string | null>(null);
  const companyCode = scope?.companyCode;
  const branchId = scope?.branchId;

  const reload = useCallback(async () => {
    if (!companyCode) {
      setWorkers([]);
      setLoading(false);
      setError(null);
      return;
    }

    const requestScope = { companyCode, ...(branchId ? { branchId } : {}) };
    setLoading(true);
    setError(null);
    try {
      setWorkers(await workerApi.list(requestScope));
    } catch (reason) {
      setWorkers([]);
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể tải danh sách lao động.",
      );
    } finally {
      setLoading(false);
    }
  }, [branchId, companyCode]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createWorker = useCallback(
    async (input: WorkerInput) => {
      if (!companyCode) throw new Error("Vui lòng chọn công ty.");
      const worker = await workerApi.create(input, {
        companyCode,
        ...(branchId ? { branchId } : {}),
      });
      await reload();
      return worker;
    },
    [branchId, companyCode, reload],
  );

  const updateWorker = useCallback(
    async (id: string, input: WorkerInput) => {
      if (!companyCode) throw new Error("Vui lòng chọn công ty.");
      const worker = await workerApi.update(id, input, {
        companyCode,
        ...(branchId ? { branchId } : {}),
      });
      await reload();
      return worker;
    },
    [branchId, companyCode, reload],
  );

  const importWorkers = useCallback(
    async (rows: BulkWorkerInput[], projectId?: string) => {
      if (!companyCode) throw new Error("Vui lòng chọn công ty.");
      const result = await workerApi.bulkCreate(
        rows,
        { companyCode, ...(branchId ? { branchId } : {}) },
        projectId,
      );
      await reload();
      return result;
    },
    [branchId, companyCode, reload],
  );

  const deleteWorker = useCallback(
    async (id: string) => {
      if (!companyCode) throw new Error("Vui lòng chọn công ty.");
      const worker = await workerApi.delete(id, {
        companyCode,
        ...(branchId ? { branchId } : {}),
      });
      await reload();
      return worker;
    },
    [branchId, companyCode, reload],
  );

  return {
    workers,
    loading,
    error,
    createWorker,
    importWorkers,
    updateWorker,
    deleteWorker,
    reload,
  };
}
