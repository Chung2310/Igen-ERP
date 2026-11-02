import React from "react";
import FinancialManagementPage from "../../modules/finance/pages/FinancialManagementPage";

export default function FinanceOverviewSection() {
  return (
    <div className="space-y-4 text-left">
      <FinancialManagementPage view="overview" />
    </div>
  );
}

