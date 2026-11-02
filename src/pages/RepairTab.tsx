import { useEffect, useState } from "react";
import { Wrench, ShieldCheck, BarChart3 } from "lucide-react";
import { ModuleNavigation, ModuleNavigationButton } from "../components/common/ModuleNavigation";
import WarrantyLookupSection from "../components/inventory/WarrantyLookupSection";
import RepairBoardPage, {
  type RepairCreatePrefill,
} from "../modules/repair/RepairBoardPage";
import RepairReportsPanel from "../modules/repair/RepairReportsPanel";

const TABS = [
  { key: "warranty", label: "Tra cứu bảo hành", icon: ShieldCheck },
  { key: "repair", label: "Phiếu sửa chữa & Bảo hành", icon: Wrench },
  { key: "reports", label: "Báo cáo doanh thu & KTV", icon: BarChart3 },
] as const;
type RepairView = (typeof TABS)[number]["key"];

export default function RepairTab() {
  const [view, setView] = useState<RepairView>("warranty");
  const [prefill, setPrefill] = useState<RepairCreatePrefill | null>(null);

  useEffect(() => {
    const openRepair = (event: Event) => {
      setPrefill((event as CustomEvent<RepairCreatePrefill>).detail);
      setView("repair");
    };
    window.addEventListener("inventory:open-repair", openRepair);
    return () =>
      window.removeEventListener("inventory:open-repair", openRepair);
  }, [setView]);

  return (
    <div className="space-y-4">
      {/* Top Tab Bar Switcher */}
      <ModuleNavigation label="Mục Sửa chữa & Bảo hành" activeValue={view}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <ModuleNavigationButton
              key={tab.key}
              active={view === tab.key}
              icon={<Icon />}
              onClick={() => setView(tab.key)}
            >
              {tab.label}
            </ModuleNavigationButton>
          );
        })}
      </ModuleNavigation>

      {/* Tab View Content */}
      <div className="min-h-0">
        {view === "repair" && (
          <RepairBoardPage
            createPrefill={prefill}
            onCreatePrefillConsumed={() => setPrefill(null)}
          />
        )}
        {view === "warranty" && <WarrantyLookupSection />}
        {view === "reports" && <RepairReportsPanel />}
      </div>
    </div>
  );
}
