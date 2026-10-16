import { useEffect, useState } from "react";
import WarrantyLookupSection from "../components/inventory/WarrantyLookupSection";
import RepairBoardPage, { type RepairCreatePrefill } from "../modules/repair/RepairBoardPage";
import RepairReportsPanel from "../modules/repair/RepairReportsPanel";
import "./repair-theme.css";

const TABS = [
  { key: "warranty", label: "Tra cứu bảo hành" },
  { key: "repair", label: "Phiếu sửa chữa" },
  { key: "reports", label: "Báo cáo" },
] as const;
type RepairView = (typeof TABS)[number]["key"];

export default function RepairTab() {
  const [view, setView] = useState<RepairView>("warranty");
  const [prefill, setPrefill] = useState<RepairCreatePrefill | null>(null);
  useEffect(() => {
    const openRepair = (event: Event) => { setPrefill((event as CustomEvent<RepairCreatePrefill>).detail); setView("repair"); };
    window.addEventListener("inventory:open-repair", openRepair);
    return () => window.removeEventListener("inventory:open-repair", openRepair);
  }, []);
  return <div className="repair-ui mx-auto max-w-[1380px] space-y-5">
    <div className="repair-ui-tabs flex flex-wrap gap-2">
      {TABS.map((tab) => <button key={tab.key} type="button" onClick={() => setView(tab.key)} aria-current={view === tab.key ? "page" : undefined} className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${view === tab.key ? "bg-primary text-white" : "bg-white text-slate-600 hover:bg-primary-fixed hover:text-cyan-700"}`}>{tab.label}</button>)}
    </div>
    {view === "warranty" && <WarrantyLookupSection />}
    {view === "repair" && <RepairBoardPage createPrefill={prefill} onCreatePrefillConsumed={() => setPrefill(null)} />}
    {view === "reports" && <RepairReportsPanel />}
  </div>;
}
