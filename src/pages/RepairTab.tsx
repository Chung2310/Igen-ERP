import { useEffect, useState } from "react";
import { Wrench, ShieldCheck, BarChart3 } from "lucide-react";
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
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
        <div className="flex gap-1 rounded-xl border border-slate-200/80 bg-white p-1 shadow-2xs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = view === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setView(tab.key)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? "bg-cyan-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${active ? "text-white" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

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
