import { useEffect, useState } from "react";
import { Copy, Pencil, Plus, Power, PowerOff, Trash2, X } from "lucide-react";
import { toast } from "../../../pages/Toast";
import { payrollService } from "../../../services/payrollService";
import { getPayrollPolicyActions, type PayrollPolicyAction } from "./payrollPolicyActions";

const DEFAULT_DEFINITION = {
  code: "", name: "", effectiveFrom: new Date().toISOString(),
  baseSalary: 2340000, regionalMinimumWage: 4960000,
  socialCapMultiplier: 20, unemploymentCapMultiplier: 20,
  funds: [
    { code: "social", employeeRate: 0.08, employerRate: 0.175, capBasis: "baseSalary" },
    { code: "health", employeeRate: 0.015, employerRate: 0.03, capBasis: "baseSalary" },
    { code: "unemployment", employeeRate: 0.01, employerRate: 0.01, capBasis: "regionalMinimum" },
  ],
  personalDeduction: 11000000, dependentDeduction: 4400000,
  taxBrackets: [{ upTo: 5000000, rate: 0.05 }, { upTo: 10000000, rate: 0.1 }, { rate: 0.2 }],
  shortTermWithholdingRate: 0.1, shortTermWithholdingThreshold: 2000000, nonResidentRate: 0.2,
  overtime: { weekday: 1.5, restDay: 2, holiday: 3, nightPremium: 0.3, nightOvertimeBonus: 0.2 }, roundingUnit: 1,
};

const editableDefinition = (policy: any) => Object.fromEntries(Object.entries(policy).filter(([key]) => !["_id", "companyCode", "status", "createdBy", "activatedBy", "activatedAt", "retiredBy", "createdAt", "updatedAt", "version", "__v"].includes(key)));
const labels: Record<PayrollPolicyAction, string> = { edit: "Sửa", clone: "Nhân bản", activate: "Áp dụng", retire: "Ngưng áp dụng", delete: "Xóa" };
const icons = { edit: Pencil, clone: Copy, activate: Power, retire: PowerOff, delete: Trash2 };

export function PayrollPolicyManager({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [json, setJson] = useState("");
  const [saving, setSaving] = useState(false);
  const load = async () => { try { setItems(await payrollService.getPolicies()); } catch (error) { toast.error(error instanceof Error ? error.message : "Không thể tải công thức lương"); } };
  useEffect(() => { void load(); }, []);

  const openEditor = (policy?: any) => {
    setEditing(policy ?? { _id: null, version: 0 });
    setJson(JSON.stringify(policy ? editableDefinition(policy) : DEFAULT_DEFINITION, null, 2));
  };
  const save = async () => {
    setSaving(true);
    try {
      const definition = JSON.parse(json);
      if (editing?._id) await payrollService.updatePolicy(editing._id, { ...definition, expectedVersion: editing.version });
      else await payrollService.createPolicy(definition);
      toast.success(editing?._id ? "Đã cập nhật bản nháp" : "Đã tạo công thức nháp");
      setEditing(null); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Cấu hình JSON không hợp lệ"); }
    finally { setSaving(false); }
  };
  const act = async (action: PayrollPolicyAction, policy: any) => {
    try {
      if (action === "edit") return openEditor(policy);
      if (action === "clone") {
        const code = window.prompt("Mã công thức mới:", `${policy.code}-copy`); if (!code) return;
        const name = window.prompt("Tên công thức mới:", `${policy.name} Bản sao`) || undefined;
        await payrollService.clonePolicy(policy._id, { code, name });
      } else if (action === "activate") await payrollService.activatePolicy(policy._id);
      else if (action === "retire") { if (!window.confirm("Ngưng áp dụng công thức này?")) return; await payrollService.retirePolicy(policy._id); }
      else if (action === "delete") { if (!window.confirm("Xóa phiên bản công thức này?")) return; await payrollService.deletePolicy(policy._id); }
      toast.success("Đã cập nhật công thức lương"); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Không thể cập nhật công thức lương"); }
  };

  return <div className="rounded-xl border border-slate-200 bg-white p-4">
    <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-800">Phiên bản công thức lương</h3><p className="text-xs text-slate-500">Chỉ bản nháp được phép sửa.</p></div>{canManage && <button onClick={() => openEditor()} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white"><Plus size={14}/>Tạo công thức</button>}</div>
    <div className="space-y-2">{items.length === 0 ? <p className="text-sm text-slate-400">Chưa có phiên bản cấu hình.</p> : items.map((policy) => <div key={policy._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3"><div><div className="font-semibold text-slate-800">{policy.name} <span className="text-xs font-normal text-slate-400">({policy.code})</span></div><div className="mt-1 text-xs text-slate-500">Hiệu lực: {String(policy.effectiveFrom).slice(0,10)}{policy.effectiveTo ? ` → ${String(policy.effectiveTo).slice(0,10)}` : ""} · <span className="font-semibold uppercase">{policy.status}</span></div></div><div className="flex flex-wrap gap-1">{getPayrollPolicyActions(canManage, policy.status).map((action) => { const Icon = icons[action]; return <button key={action} onClick={() => void act(action, policy)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"><Icon size={12}/>{labels[action]}</button>; })}</div></div>)}</div>
    {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setEditing(null)}><div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white p-5" onClick={(event) => event.stopPropagation()}><div className="mb-3 flex justify-between"><div><h3 className="font-bold">{editing._id ? "Sửa bản nháp" : "Tạo công thức lương"}</h3><p className="text-xs text-slate-500">Nhập đầy đủ định nghĩa công thức ở định dạng JSON.</p></div><button onClick={() => setEditing(null)}><X size={18}/></button></div><textarea value={json} onChange={(event) => setJson(event.target.value)} className="min-h-0 flex-1 rounded-lg border border-slate-300 p-3 font-mono text-xs" rows={24}/><div className="mt-3 flex justify-end gap-2"><button onClick={() => setEditing(null)} className="rounded-lg border px-3 py-2 text-sm">Hủy</button><button disabled={saving} onClick={() => void save()} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50">{saving ? "Đang lưu..." : "Lưu bản nháp"}</button></div></div></div>}
  </div>;
}
