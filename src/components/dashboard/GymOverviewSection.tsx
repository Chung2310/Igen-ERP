import { useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useBranch } from "../../context/BranchContext";
import type { GymTab } from "../../../shared/gym/types";
import { gymApi } from "../../modules/gym/api";
import DashboardPage from "../../modules/gym/DashboardPage";
import { Feedback } from "../../modules/gym/ui";
import "../../modules/gym/gym.css";

function navigateToGymSubTab(tab: GymTab, branchId: string) {
  const params = new URLSearchParams({ sub: tab });
  if (branchId) params.set("branch", branchId);
  window.history.pushState(null, "", `/gym?${params.toString()}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export default function GymOverviewSection() {
  const { userProfile } = useAuth();
  const branch = useBranch();
  const api = useMemo(
    () => (branch.activeBranchId ? gymApi(branch.activeBranchId) : null),
    [branch.activeBranchId],
  );

  if (branch.loading) {
    return (
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
        <Feedback loading />
      </div>
    );
  }

  if (!branch.activeBranchId || !api) {
    return (
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
        <Feedback
          error={
            branch.error ||
            "Chọn chi nhánh đang hoạt động để xem Tổng quan Phòng Gym."
          }
        />
      </div>
    );
  }

  return (
    <div
      key={`${userProfile?.uid || "user"}:${branch.activeBranchId}`}
      className="px-1 py-1"
    >
      <DashboardPage
        api={api}
        onNavigate={(tab) => navigateToGymSubTab(tab, branch.activeBranchId!)}
      />
    </div>
  );
}
