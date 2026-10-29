import { useState } from "react";
import { FileText, QrCode } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useBranch } from "../../context/BranchContext";
import { ModuleNavigationButton } from "../common/ModuleNavigation";
import WarrantyLookupPage from "../../modules/retail/pages/WarrantyLookupPage";
import OrderWarrantyPage from "../../modules/retail/pages/OrderWarrantyPage";
import type { WarrantyLookupScope } from "../../services/retailWarrantyService";
import type { RepairCreatePrefill } from "../../modules/repair/RepairBoardPage";

export default function WarrantyLookupSection() {
  const { userProfile, hasPermission } = useAuth();
  const branch = useBranch();
  const companyCode = userProfile?.companyCode;
  const branchId = branch.activeBranchId || userProfile?.branchId;
  if (branch.loading) return <p role="status" className="p-4 text-sm text-on-surface-variant">Đang tải chi nhánh…</p>;
  if (!companyCode || !branchId) return <p role="status" className="p-4 text-sm text-on-surface-variant">Chọn chi nhánh để tra cứu bảo hành.</p>;
  const admin = userProfile?.role === "admin" || userProfile?.role === "superadmin";
  const canCreate = admin || hasPermission("repair:manage");
  const canReport = canCreate || hasPermission("retail:manage");
  return <WarrantyWorkspace key={`${userProfile?.uid}:${companyCode}:${branchId}`} scope={{ companyCode, branchId }} canCreate={canCreate} canReport={canReport} />;
}

function WarrantyWorkspace({ scope, canCreate, canReport }: { scope: WarrantyLookupScope; canCreate: boolean; canReport: boolean }) {
  const [mode, setMode] = useState<"code" | "order">("code");
  const controls = <div role="group" aria-label="Cách tra cứu bảo hành" data-module-navigation className="flex max-w-full flex-wrap gap-1 rounded-xl border border-outline-variant bg-surface-container-lowest p-1">
    <ModuleNavigationButton active={mode === "code"} icon={<QrCode />} onClick={() => setMode("code")}>Serial / mã vạch</ModuleNavigationButton>
    <ModuleNavigationButton active={mode === "order"} icon={<FileText />} onClick={() => setMode("order")}>Đơn hàng / khách hàng</ModuleNavigationButton>
  </div>;
  const openRepair = (prefill: RepairCreatePrefill) => window.dispatchEvent(new CustomEvent("inventory:open-repair", { detail: prefill }));
  return mode === "code" ? <WarrantyLookupPage scope={scope} actions={controls} onCreateRepair={canCreate ? openRepair : undefined} canManage={canReport} />
    : <div className="space-y-5"><div className="flex justify-end">{controls}</div><OrderWarrantyPage /></div>;
}
