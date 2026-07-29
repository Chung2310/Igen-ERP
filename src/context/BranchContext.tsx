import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { branchService, type BranchRecord } from "../services/branchService";
import { buildBranchRequestInit } from "./branchFetch";

export type BranchOption = BranchRecord;
interface BranchContextValue { branches: BranchOption[]; activeBranchId: string; activeBranch?: BranchOption; setActiveBranchId: (id: string) => void; loading: boolean; }
const BranchContext = createContext<BranchContextValue | null>(null);

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { userProfile } = useAuth();
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [activeBranchId, setActiveBranchIdState] = useState("");
  const [loading, setLoading] = useState(false);
  const canSwitch = userProfile?.role === "admin";
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (!url.includes("/api/v1/") || !userProfile?.companyCode) return originalFetch(input, init);
      const selected = localStorage.getItem(`igen.activeBranch.${userProfile.companyCode}`);
      return originalFetch(input, buildBranchRequestInit(input, init, selected));
    };
    return () => { window.fetch = originalFetch; };
  }, [userProfile?.companyCode]);
  useEffect(() => {
    if (!userProfile?.companyCode || !canSwitch) { setBranches([]); setActiveBranchIdState(userProfile?.branchId || ""); return; }
    const load = async () => {
      setLoading(true);
      try {
        const list = (await branchService.list()).filter((branch) => branch.isActive);
        setBranches(list);
        const key = `igen.activeBranch.${userProfile.companyCode}`;
        const saved = localStorage.getItem(key);
        // null = never chosen yet (default to first branch); "" = explicit "Tất cả chi nhánh" (keep it).
        setActiveBranchIdState(
          saved === null ? (list[0]?._id || "") :
          saved === "" || list.some((branch) => branch._id === saved) ? saved : (list[0]?._id || "")
        );
      } catch { setBranches([]); }
      finally { setLoading(false); }
    };
    void load();
    const handleBranchChange = () => { void load(); };
    window.addEventListener("branch-change", handleBranchChange);
    return () => window.removeEventListener("branch-change", handleBranchChange);
  }, [userProfile?.uid, userProfile?.companyCode, userProfile?.role, canSwitch]);
  const setActiveBranchId = (id: string) => { setActiveBranchIdState(id); if (userProfile?.companyCode) localStorage.setItem(`igen.activeBranch.${userProfile.companyCode}`, id); };
  const value = useMemo(() => ({ branches, activeBranchId, activeBranch: branches.find((b) => b._id === activeBranchId), setActiveBranchId, loading }), [branches, activeBranchId, loading]);
  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}
export function useBranch() { const value = useContext(BranchContext); if (!value) throw new Error("useBranch must be used within BranchProvider"); return value; }
