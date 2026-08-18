import { useEffect, useState } from "react";
import WarrantyLookupSection from "../components/inventory/WarrantyLookupSection";
import RepairBoardPage, { type RepairCreatePrefill } from "../modules/repair/RepairBoardPage";

export default function RepairTab() {
  const [view, setView] = useState<"warranty" | "repair">("warranty");
  const [prefill, setPrefill] = useState<RepairCreatePrefill | null>(null);
  useEffect(() => {
    const openRepair = (event: Event) => { setPrefill((event as CustomEvent<RepairCreatePrefill>).detail); setView("repair"); };
    window.addEventListener("inventory:open-repair", openRepair);
    return () => window.removeEventListener("inventory:open-repair", openRepair);
  }, []);
  return <div className="space-y-4"><div className="flex flex-wrap gap-2 border-b pb-3"><button type="button" onClick={() => setView("warranty")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${view === "warranty" ? "bg-cyan-600 text-white" : "border text-slate-600"}`}>Tra cứu bảo hành</button><button type="button" onClick={() => setView("repair")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${view === "repair" ? "bg-cyan-600 text-white" : "border text-slate-600"}`}>Phiếu sửa chữa</button></div>{view === "warranty" ? <WarrantyLookupSection /> : <RepairBoardPage createPrefill={prefill} onCreatePrefillConsumed={() => setPrefill(null)} />}</div>;
}
