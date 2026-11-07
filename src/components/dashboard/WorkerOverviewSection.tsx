import { useAuth } from "../../context/AuthContext";
import { useBranchOptional } from "../../context/BranchContext";
import WorkerOverviewDashboard from "./WorkerOverviewDashboard";

export default function WorkerOverviewSection() {
  const { userProfile, hasPermission } = useAuth();
  const branch = useBranchOptional();
  if (!userProfile?.companyCode) return null;
  return <WorkerOverviewDashboard companyCode={userProfile.companyCode} branchId={branch?.activeBranchId || userProfile.branchId || undefined} canSeePartners={hasPermission("labor-partner:read") || hasPermission("labor-partner:manage") || userProfile.role === "admin" || userProfile.role === "superadmin"} />;
}

