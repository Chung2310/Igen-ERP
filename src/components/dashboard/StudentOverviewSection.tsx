import React from "react";
import { DashboardPage } from "../../modules/student-management/pages/Dashboard/DashboardPage";

function formatDateLabel() {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

export default function StudentOverviewSection() {
  const handleNavigate = (view: string) => {
    window.history.pushState(null, "", `/quan-ly-hoc-vien?sub=${view}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleSelectStudent = () => {
    window.history.pushState(null, "", `/quan-ly-hoc-vien?sub=hoc-vien`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <div className="space-y-4 text-left">
      <DashboardPage
        formattedDate={formatDateLabel()}
        onSelectStudent={handleSelectStudent}
        onNavigate={handleNavigate}
      />
    </div>
  );
}

