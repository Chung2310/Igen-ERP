import React from "react";
import { WorkerDashboardPage } from "../../modules/worker-management/pages/WorkerDashboardPage";

function formatDateLabel() {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

export default function WorkerOverviewSection() {
  const handleNavigate = (view?: string) => {
    window.history.pushState(null, "", `/quan-ly-lao-dong${view ? `?sub=${view}` : ""}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <div className="space-y-4 text-left">
      <WorkerDashboardPage
        formattedDate={formatDateLabel()}
        onNavigate={handleNavigate}
      />
    </div>
  );
}

