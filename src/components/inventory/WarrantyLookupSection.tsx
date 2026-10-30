import { useAuth } from "../../context/AuthContext";
import { useBranch } from "../../context/BranchContext";
import WarrantyLookupPage from "../../modules/retail/pages/WarrantyLookupPage";
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
  const openRepair = (prefill: RepairCreatePrefill) => window.dispatchEvent(new CustomEvent("inventory:open-repair", { detail: prefill }));
  return <WarrantyLookupPage key={`${userProfile?.uid}:${companyCode}:${branchId}`} scope={{ companyCode, branchId }} onCreateRepair={canCreate ? openRepair : undefined} canCreate={canCreate} />;
}
