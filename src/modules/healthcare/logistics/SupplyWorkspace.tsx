import "./logistics.css";
import { useMemo, useState } from "react";
import { HrPageTitle } from "../../../components/hr/HrPageTitle";
import { healthcareApi } from "../api";
import { cn } from "../../student-management/lib/utils";
import type { DirectoryKind } from "../../../../shared/healthcare-logistics";
import LogisticsPage from "./LogisticsPage";
import SupplyCatalog from "./SupplyCatalog";
import DirectoryPage from "./DirectoryPage";
import SupplyProfiles from "./SupplyProfiles";

const tabs = [
  ["supplies", "Vật tư"],
  ["transactions", "Nhập / Xuất kho"],
  ["suppliers", "Nhà cung cấp"],
  ["warehouses", "Kho lưu trữ"],
  ["categories", "Phân loại"],
  ["balances", "Tồn theo lô"],
  ["catalog", "Đơn vị quy đổi"],
];

export default function SupplyWorkspace({
  branchId,
  hasPermission,
}: {
  branchId: string;
  hasPermission: (code: string) => boolean;
}) {
  const api = useMemo(() => healthcareApi(branchId), [branchId]);
  const [active, setActive] = useState(() => {
    const value = new URLSearchParams(location.search).get("section");
    return tabs.some(([key]) => key === value) ? value! : "supplies";
  });
  const [version, setVersion] = useState(0);
  const [headerActionsEl, setHeaderActionsEl] = useState<HTMLDivElement | null>(null);
  const canManage = hasPermission("healthcare:manage");
  function navigate(value: string) {
    setActive(value);
    const url = new URL(location.href);
    url.searchParams.set("section", value);
    history.replaceState(history.state, "", url);
  }
  return (
    <section className="healthcare-logistics min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-4 pt-2 lg:pl-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <HrPageTitle>Quản lý Vật tư &amp; Thiết bị tiêu hao</HrPageTitle>
        <div ref={setHeaderActionsEl} className="flex flex-wrap items-center gap-2" />
      </div>
      <nav
        aria-label="Điều hướng quản lý vật tư"
        className="flex gap-1 overflow-x-auto border-b border-outline-variant"
      >
        {tabs.map(([key, label]) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={isActive}
              className={cn(
                "shrink-0 cursor-pointer border-b-2 px-3.5 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
                isActive
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent font-medium text-on-surface-variant hover:border-outline-variant hover:text-on-surface",
              )}
              onClick={() => navigate(key)}
            >
              {label}
            </button>
          );
        })}
      </nav>
      {active === "supplies" && (
        <SupplyCatalog
          key={version}
          api={api}
          canManage={canManage}
          headerActionsContainer={headerActionsEl}
        />
      )}
      {active === "transactions" && (
        <LogisticsPage
          key="transactions"
          kind="supplies"
          branchId={branchId}
          hasPermission={hasPermission}
          initialView="documents"
          embedded
        />
      )}
      {active === "balances" && (
        <LogisticsPage
          key="balances"
          kind="supplies"
          branchId={branchId}
          hasPermission={hasPermission}
          initialView="balances"
          embedded
        />
      )}
      {active === "catalog" && <SupplyProfiles api={api} canManage={canManage} />}
      {["suppliers", "warehouses", "categories"].includes(active) && (
        <DirectoryPage
          key={active}
          api={api}
          kind={active as DirectoryKind}
          canManage={canManage}
          onChanged={() => setVersion((v) => v + 1)}
        />
      )}
    </section>
  );
}
