import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { branchService, type BranchRecord } from "../services/branchService";
import { buildBranchRequestInit } from "./branchFetch";
import { resolveActiveBranchId } from "./branchSelection";
import { withRequestTimeout } from "../utils/requestTimeout";

export type BranchOption = BranchRecord;
interface BranchContextValue {
  branches: BranchOption[];
  activeBranchId: string;
  activeBranch?: BranchOption;
  setActiveBranchId: (id: string) => void;
  loading: boolean;
  error: string;
  retry: () => void;
}
const BranchContext = createContext<BranchContextValue | null>(null);

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { userProfile } = useAuth();
  const companyCode = userProfile?.companyCode;
  const canSwitch = userProfile?.role === "admin";
  const scopeKey = JSON.stringify([userProfile?.uid, companyCode, userProfile?.role, userProfile?.branchId]);
  const [result, setResult] = useState<{ key: string; branches: BranchOption[]; id: string; loading: boolean; error: string }>({ key: '', branches: [], id: '', loading: false, error: '' });
  const [attempt, setAttempt] = useState(0);
  const version = useRef(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useLayoutEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (!url.includes("/api/v1/") || !companyCode) return originalFetch(input, init);
      const selected = canSwitch ? localStorage.getItem(`igen.activeBranch.${companyCode}`) : userProfile?.branchId || null;
      return originalFetch(input, buildBranchRequestInit(input, init, selected));
    };
    return () => { window.fetch = originalFetch; };
  }, [companyCode, canSwitch, userProfile?.branchId]);

  useEffect(() => {
    const controller = new AbortController();
    const current = ++version.current;
    if (!companyCode || !canSwitch) return () => controller.abort();
    const run = async () => {
      setResult((previous) => ({ key: scopeKey, branches: previous.key === scopeKey ? previous.branches : [], id: previous.key === scopeKey ? previous.id : '', loading: true, error: '' }));
      try {
        const list = (await withRequestTimeout((signal) => branchService.list(signal), 15000, 'Tải chi nhánh quá lâu. Vui lòng thử lại.', controller.signal)).filter((branch) => branch.isActive);
        if (controller.signal.aborted || version.current !== current) return;
        const key = `igen.activeBranch.${companyCode}`;
        const id = resolveActiveBranchId(list, localStorage.getItem(key));
        localStorage.setItem(key, id);
        setResult({ key: scopeKey, branches: list, id, loading: false, error: list.length ? '' : 'Doanh nghiệp chưa có chi nhánh hoạt động. Kiểm tra cấu hình chi nhánh rồi thử lại.' });
      } catch (cause) {
        if (controller.signal.aborted || version.current !== current) return;
        setResult({ key: scopeKey, branches: [], id: '', loading: false, error: cause instanceof Error ? cause.message : 'Không thể tải chi nhánh. Vui lòng thử lại.' });
      }
    };
    void run();
    window.addEventListener("branch-change", retry);
    return () => { controller.abort(); window.removeEventListener("branch-change", retry); };
  }, [scopeKey, companyCode, canSwitch, attempt, retry]);

  const branches = useMemo(() => result.key === scopeKey && canSwitch ? result.branches : [], [result.key, result.branches, scopeKey, canSwitch]);
  const activeBranchId = canSwitch ? (result.key === scopeKey ? result.id : '') : userProfile?.branchId || '';
  const loading = Boolean(companyCode && canSwitch && (result.key !== scopeKey || result.loading));
  const error = result.key === scopeKey && canSwitch ? result.error : '';
  const setActiveBranchId = useCallback((id: string) => {
    if (!companyCode || !canSwitch) return;
    setResult((previous) => {
      if (previous.key !== scopeKey || !previous.branches.some((branch) => branch._id === id)) return previous;
      localStorage.setItem(`igen.activeBranch.${companyCode}`, id);
      return { ...previous, id };
    });
  }, [scopeKey, companyCode, canSwitch]);
  const value = useMemo(() => ({ branches, activeBranchId, activeBranch: branches.find((branch) => branch._id === activeBranchId), setActiveBranchId, loading, error, retry }), [branches, activeBranchId, setActiveBranchId, loading, error, retry]);
  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}
export function useBranch() {
  const value = useContext(BranchContext);
  if (!value) throw new Error("useBranch must be used within BranchProvider");
  return value;
}
export function useBranchOptional() { return useContext(BranchContext); }
