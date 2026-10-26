import { useAuth } from "../../../context/AuthContext";
import { useBranch } from "../../../context/BranchContext";
export function useRetailScope() { const { userProfile, logout } = useAuth(); const { activeBranchId, activeBranch } = useBranch(); return { scope: userProfile?.companyCode && activeBranchId ? { companyCode: userProfile.companyCode, branchId: activeBranchId } : null, userProfile, branchName: activeBranch?.name, logout }; }
