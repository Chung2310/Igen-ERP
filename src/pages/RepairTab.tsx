import { useEffect, useState } from "react";
import WarrantyLookupSection from "../components/inventory/WarrantyLookupSection";
import RepairBoardPage, { type RepairCreatePrefill } from "../modules/repair/RepairBoardPage";
import RepairReportsPanel from "../modules/repair/RepairReportsPanel";

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
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2 border-b pb-3">
      {TABS.map((tab) => <button key={tab.key} type="button" onClick={() => setView(tab.key)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${view === tab.key ? "bg-cyan-600 text-white" : "border text-slate-600"}`}>{tab.label}</button>)}
    </div>
    {view === "warranty" && <WarrantyLookupSection />}
    {view === "repair" && <RepairBoardPage createPrefill={prefill} onCreatePrefillConsumed={() => setPrefill(null)} />}
    {view === "reports" && <RepairReportsPanel />}
  </div>;
}
