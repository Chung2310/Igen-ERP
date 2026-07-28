import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { branchService, type BranchRecord } from "../services/branchService";

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
    if (!userProfile?.companyCode || !canSwitch) { setBranches([]); setActiveBranchIdState(userProfile?.branchId || ""); return; }
    const load = async () => {
      setLoading(true);
      try {
        const list = (await branchService.list()).filter((branch) => branch.isActive);
        setBranches(list);
        const key = `igen.activeBranch.${userProfile.companyCode}`;
        const saved = localStorage.getItem(key);
        setActiveBranchIdState(list.some((branch) => branch._id === saved) ? saved! : (list[0]?._id || ""));
      } catch { setBranches([]); }
      finally { setLoading(false); }
    };
    void load();
    const handleBranchChange = () => { void load(); };
    window.addEventListener("branch-change", handleBranchChange);
    return () => window.removeEventListener("branch-change", handleBranchChange);
  }, [userProfile?.uid, userProfile?.companyCode, userProfile?.role, canSwitch]);
  const setActiveBranchId = (id: string) => { setActiveBranchIdState(id); if (userProfile?.companyCode) localStorage.setItem(`igen.activeBranch.${userProfile.companyCode}`, id); window.dispatchEvent(new CustomEvent("branch-change", { detail: { branchId: id } })); };
  const value = useMemo(() => ({ branches, activeBranchId, activeBranch: branches.find((b) => b._id === activeBranchId), setActiveBranchId, loading }), [branches, activeBranchId, loading]);
  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}
export function useBranch() { const value = useContext(BranchContext); if (!value) throw new Error("useBranch must be used within BranchProvider"); return value; }