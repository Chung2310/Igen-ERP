import { useEffect, useState } from "react";
import { BarChart3, ShieldCheck, Wrench } from "lucide-react";
import { ModuleNavigation, ModuleNavigationButton } from "../components/common/ModuleNavigation";
import WarrantyLookupSection from "../components/inventory/WarrantyLookupSection";
import RepairBoardPage, { type RepairCreatePrefill } from "../modules/repair/RepairBoardPage";
import RepairReportsPanel from "../modules/repair/RepairReportsPanel";
import "./repair-theme.css";

const TABS = [
  { key: "warranty", label: "Tra cứu bảo hành", icon: ShieldCheck },
  { key: "repair", label: "Phiếu sửa chữa", icon: Wrench },
  { key: "reports", label: "Báo cáo", icon: BarChart3 },
] as const;
type RepairView = (typeof TABS)[number]["key"];

export default function RepairTab() {
  const [view, setView] = useState<RepairView>("repair");
  const [prefill, setPrefill] = useState<RepairCreatePrefill | null>(null);
  useEffect(() => {
    const openRepair = (event: Event) => { setPrefill((event as CustomEvent<RepairCreatePrefill>).detail); setView("repair"); };
    window.addEventListener("inventory:open-repair", openRepair);
    return () => window.removeEventListener("inventory:open-repair", openRepair);
  }, []);
  return <div className="flex h-full min-h-0 flex-col bg-surface" id="repair_tab_wrapper">
    <h1 className="sr-only text-balance">Bảo hành và sửa chữa</h1>
    <ModuleNavigation label="Mục Sửa chữa và bảo hành" activeValue={view}>
      {TABS.map(tab => <ModuleNavigationButton key={tab.key} active={view === tab.key} icon={<tab.icon />} onClick={() => setView(tab.key)}>{tab.label}</ModuleNavigationButton>)}
    </ModuleNavigation>
    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6">
      <div className="repair-ui mx-auto w-full max-w-[1380px]">
        {view === "warranty" && <WarrantyLookupSection />}
        {view === "repair" && <RepairBoardPage createPrefill={prefill} onCreatePrefillConsumed={() => setPrefill(null)} />}
        {view === "reports" && <RepairReportsPanel />}
      </div>
    </div>
  </div>;
}
