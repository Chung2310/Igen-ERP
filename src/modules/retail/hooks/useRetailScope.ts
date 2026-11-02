import { useAuth } from "../../../context/AuthContext";
import { useBranch } from "../../../context/BranchContext";
import { getPosTerminalId } from "../posTerminal";

export function useRetailScope() {
  const { userProfile } = useAuth();
  const branchContext = useBranch();
  const activeBranchId = branchContext?.activeBranchId || userProfile?.branchId;
  const activeBranch = branchContext?.activeBranch || branchContext?.branches?.find((b) => b._id === activeBranchId);
  const branchName =
    activeBranch?.name ||
    userProfile?.branchName ||
    "";

  return {
    scope: userProfile?.companyCode && activeBranchId
      ? {
          companyCode: userProfile.companyCode,
          branchId: activeBranchId,
          terminalId: getPosTerminalId(userProfile.companyCode, activeBranchId),
        }
      : null,
    userProfile,
    activeBranch,
    branchName,
  };
}
