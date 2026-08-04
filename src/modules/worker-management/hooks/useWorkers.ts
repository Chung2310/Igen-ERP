import { useCallback, useEffect, useState } from "react";
import { workerApi } from "../api/workers.api";
import type { Worker, WorkerInput } from "../types";

export function useWorkers(scope?: string) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setWorkers(await workerApi.list()); }
    catch (reason) { setWorkers([]); setError(reason instanceof Error ? reason.message : "Không thể tải danh sách lao động."); }
    finally { setLoading(false); }
  }, [scope]);
  useEffect(() => { void reload(); }, [reload]);
  const createWorker = useCallback(async (input: WorkerInput) => { const worker = await workerApi.create(input); await reload(); return worker; }, [reload]);
  const updateWorker = useCallback(async (id: string, input: WorkerInput) => { const worker = await workerApi.update(id, input); await reload(); return worker; }, [reload]);
  const deleteWorker = useCallback(async (id: string) => { const worker = await workerApi.delete(id); await reload(); return worker; }, [reload]);
  return { workers, loading, error, createWorker, updateWorker, deleteWorker, reload };
}