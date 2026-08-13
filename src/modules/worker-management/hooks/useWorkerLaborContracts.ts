import { useCallback, useEffect, useRef, useState } from "react";
import { workerLaborContractApi } from "../api/workerLaborContracts.api";
import type {
  WorkerLaborContract,
  WorkerLaborContractInput,
  WorkerScope,
} from "../types";

/**
 * Danh sách hợp đồng lao động trong phạm vi hiện tại. Truyền workerId để chỉ lấy
 * chuỗi hợp đồng của một người (dùng trong hồ sơ lao động).
 */
export function useWorkerLaborContracts(scope?: WorkerScope, workerId?: string) {
  const [loading, setLoading] = useState(Boolean(scope));
  const [error, setError] = useState<string | null>(null);
  const companyCode = scope?.companyCode;
  const branchId = scope?.branchId;
  const scopeKey = companyCode ? `${companyCode}:${branchId || ""}:${workerId || ""}` : "";
  const [state, setState] = useState<{ scopeKey: string; items: WorkerLaborContract[] }>({
    scopeKey,
    items: [],
  });
  const activeScopeKeyRef = useRef(scopeKey);
  activeScopeKeyRef.current = scopeKey;
  const contracts = state.scopeKey === scopeKey ? state.items : [];

  const reload = useCallback(async () => {
    if (!companyCode) {
      setState({ scopeKey, items: [] });
      setLoading(false);
      setError(null);
      return;
    }
    const requestScope = { companyCode, ...(branchId ? { branchId } : {}) };
    setLoading(true);
    setError(null);
    try {
      const items = await workerLaborContractApi.list(
        requestScope,
        workerId ? { workerId } : {},
      );
      if (activeScopeKeyRef.current === scopeKey) setState({ scopeKey, items });
    } catch (reason) {
      if (activeScopeKeyRef.current !== scopeKey) return;
      setState({ scopeKey, items: [] });
      setError(
        reason instanceof Error ? reason.message : "Không thể tải danh sách hợp đồng.",
      );
    } finally {
      if (activeScopeKeyRef.current === scopeKey) setLoading(false);
    }
  }, [branchId, companyCode, scopeKey, workerId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const requireScope = useCallback((): WorkerScope => {
    if (!companyCode) throw new Error("Vui lòng chọn công ty.");
    return { companyCode, ...(branchId ? { branchId } : {}) };
  }, [branchId, companyCode]);

  const createContract = useCallback(
    async (input: WorkerLaborContractInput) => {
      const contract = await workerLaborContractApi.create(input, requireScope());
      await reload();
      return contract;
    },
    [reload, requireScope],
  );

  const updateContract = useCallback(
    async (id: string, input: Partial<WorkerLaborContractInput>) => {
      const contract = await workerLaborContractApi.update(id, input, requireScope());
      await reload();
      return contract;
    },
    [reload, requireScope],
  );

  const renewContract = useCallback(
    async (id: string, input: WorkerLaborContractInput) => {
      const result = await workerLaborContractApi.renew(id, input, requireScope());
      await reload();
      return result;
    },
    [reload, requireScope],
  );

  const deleteContract = useCallback(
    async (id: string) => {
      const result = await workerLaborContractApi.remove(id, requireScope());
      await reload();
      return result;
    },
    [reload, requireScope],
  );

  return {
    contracts,
    loading,
    error,
    createContract,
    updateContract,
    renewContract,
    deleteContract,
    reload,
  };
}
