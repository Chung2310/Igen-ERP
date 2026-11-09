import { useLayoutEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useBranch } from "../../context/BranchContext";
import { configureQuotationClient } from "./api";
import QuotationApp from "./App";
import "./styles.css";
import "./homepage.css";
import "./erp.css";
import "./hr-alignment.css";
import "./quotation-controls.css";

function ScopedQuotation() {
  const { userProfile } = useAuth(); const { activeBranchId } = useBranch();
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    if (!userProfile?.companyCode || !activeBranchId) return;
    const release = configureQuotationClient({ companyCode: userProfile.companyCode, branchId: activeBranchId,
      capabilities: userProfile.permissions || [], modules: userProfile.enabledModules || [], user: { id: userProfile.uid, email: userProfile.email, name: userProfile.displayName, role: "user" } });
    setReady(true);
    return release;
  }, [userProfile?.uid, userProfile?.companyCode, userProfile?.permissions, userProfile?.enabledModules, activeBranchId]);
  if (!ready) return <p role="status" className="p-6 text-sm text-on-surface-variant">Đang mở phân hệ Báo giá…</p>;
  return <div className="quotation-module"><QuotationApp /></div>;
}
export default function QuotationTab() {
  const { userProfile } = useAuth(); const { activeBranchId } = useBranch();
  return <ScopedQuotation key={`${userProfile?.uid}:${userProfile?.companyCode}:${activeBranchId}`} />;
}
