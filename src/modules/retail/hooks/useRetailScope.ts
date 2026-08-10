import { useAuth } from "../../../context/AuthContext";
import { useBranch } from "../../../context/BranchContext";
export function useRetailScope() { const { userProfile } = useAuth(); const { activeBranchId } = useBranch(); return { scope: userProfile?.companyCode && activeBranchId ? { companyCode: userProfile.companyCode, branchId: activeBranchId } : null, userProfile }; }
