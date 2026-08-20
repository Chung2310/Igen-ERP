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
export function useWorkerLaborContracts(
  scope?: WorkerScope,
  workerId?: string,
  initialAlertOnly = false,
) {
  const [loading, setLoading] = useState(Boolean(scope));
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [client, setClient] = useState("all");
  const [alertOnly, setAlertOnly] = useState(initialAlertOnly);
  const [clients, setClients] = useState<string[]>([]);

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

  const reload = useCallback(async (
    currentPage = page,
    currentSearch = debouncedSearch,
    currentStatus = status,
    currentClient = client,
    currentAlertOnly = alertOnly
  ) => {
    if (!companyCode) {
      setState({ scopeKey, items: [] });
      setTotal(0);
      setClients([]);
      setLoading(false);
      setError(null);
      return;
    }
    const requestScope = { companyCode, ...(branchId ? { branchId } : {}) };
    setLoading(true);
    setError(null);
    try {
      const response = await workerLaborContractApi.list(
        requestScope,
        {
          ...(workerId ? { workerId } : {}),
          page: currentPage,
          limit,
          search: currentSearch || undefined,
          status: currentStatus !== "all" ? currentStatus : undefined,
          alert: currentAlertOnly ? "any" : undefined,
          clientName: currentClient !== "all" ? currentClient : undefined,
        },
      );
      if (activeScopeKeyRef.current === scopeKey) {
        setState({ scopeKey, items: response.data });
        setTotal(response.total);
        setClients(response.clients || []);
      }
    } catch (reason) {
      if (activeScopeKeyRef.current !== scopeKey) return;
      setState({ scopeKey, items: [] });
      setTotal(0);
      setClients([]);
      setError(
        reason instanceof Error ? reason.message : "Không thể tải danh sách hợp đồng.",
      );
    } finally {
      if (activeScopeKeyRef.current === scopeKey) setLoading(false);
    }
  }, [branchId, companyCode, scopeKey, workerId, page, limit, debouncedSearch, status, client, alertOnly]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [status, client, alertOnly]);

  useEffect(() => {
    void reload(page, debouncedSearch, status, client, alertOnly);
  }, [reload, page, debouncedSearch, status, client, alertOnly]);

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
    page,
    setPage,
    limit,
    total,
    search,
    setSearch,
    status,
    setStatus,
    client,
    setClient,
    alertOnly,
    setAlertOnly,
    clients,
    createContract,
    updateContract,
    renewContract,
    deleteContract,
    reload,
  };
}
