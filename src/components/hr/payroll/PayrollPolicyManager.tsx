import { useEffect, useState } from "react";
import { Copy, Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { toast } from "../../../pages/Toast";
import { payrollService } from "../../../services/payrollService";
import { PayrollPolicyConfirmDialog } from "./PayrollPolicyConfirmDialog";
import { PayrollPolicyFormModal } from "./PayrollPolicyFormModal";
import type { PayrollPolicyDefinition } from "./payrollPolicyForm";
import { getPayrollPolicyActions, type PayrollPolicyAction } from "./payrollPolicyActions";

const editableDefinition = (policy: any) => Object.fromEntries(Object.entries(policy).filter(([key]) => !["_id", "companyCode", "status", "createdBy", "activatedBy", "activatedAt", "retiredBy", "createdAt", "updatedAt", "version", "__v"].includes(key)));
const labels: Record<PayrollPolicyAction, string> = { edit: "Sửa", clone: "Nhân bản", activate: "Áp dụng", retire: "Ngưng áp dụng", delete: "Xóa" };
const icons = { edit: Pencil, clone: Copy, activate: Power, retire: PowerOff, delete: Trash2 };
type Editor = { mode: "create" | "edit" | "clone"; policy?: any };
type Confirmation = { action: "replace" | "retire" | "delete"; policy: any };

export function PayrollPolicyManager({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmationError, setConfirmationError] = useState("");
  const load = async () => { try { setItems(await payrollService.getPolicies()); } catch (error) { toast.error(error instanceof Error ? error.message : "Không thể tải công thức lương"); } };
  useEffect(() => { void load(); }, []);

  const save = async (definition: PayrollPolicyDefinition) => {
    setSaving(true);
    try {
      if (editor?.mode === "edit") await payrollService.updatePolicy(editor.policy._id, { ...definition, expectedVersion: editor.policy.version });
      else if (editor?.mode === "clone") await payrollService.clonePolicy(editor.policy._id, { code: definition.code, name: definition.name, definition });
      else await payrollService.createPolicy(definition);
      toast.success(editor?.mode === "edit" ? "Đã cập nhật bản nháp" : editor?.mode === "clone" ? "Đã nhân bản công thức" : "Đã tạo công thức nháp");
      setEditor(null); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Không thể lưu công thức lương"); }
    finally { setSaving(false); }
  };

  const act = async (action: PayrollPolicyAction, policy: any) => {
    if (action === "edit") { setEditor({ mode: "edit", policy }); return; }
    if (action === "clone") { setEditor({ mode: "clone", policy }); return; }
    if (action === "retire" || action === "delete") { setConfirmation({ action, policy }); setConfirmationError(""); return; }
    try {
      await payrollService.activatePolicy(policy._id);
      toast.success("Đã áp dụng công thức lương"); await load();
    } catch (error) {
      if ((error as { code?: string })?.code === "PAYROLL_POLICY_OVERLAP") { setConfirmation({ action: "replace", policy }); setConfirmationError(""); return; }
      toast.error(error instanceof Error ? error.message : "Không thể áp dụng công thức lương");
    }
  };

  const confirmAction = async () => {
    if (!confirmation) return;
    setConfirming(true); setConfirmationError("");
    try {
      if (confirmation.action === "replace") await payrollService.activatePolicy(confirmation.policy._id, { replaceOverlaps: true });
      else if (confirmation.action === "retire") await payrollService.retirePolicy(confirmation.policy._id);
      else await payrollService.deletePolicy(confirmation.policy._id);
      toast.success(confirmation.action === "replace" ? "Đã thay thế công thức đang áp dụng" : confirmation.action === "retire" ? "Đã ngưng áp dụng công thức" : "Đã xóa công thức");
      setConfirmation(null); await load();
    } catch (error) { setConfirmationError(error instanceof Error ? error.message : "Không thể cập nhật công thức lương"); }
    finally { setConfirming(false); }
  };

  const overlappingPolicies = confirmation?.action === "replace" ? items.filter((item) => {
    if (item.status !== "active" || item._id === confirmation.policy._id) return false;
    const newStart = new Date(confirmation.policy.effectiveFrom).getTime();
    const newEnd = confirmation.policy.effectiveTo ? new Date(confirmation.policy.effectiveTo).getTime() : Number.POSITIVE_INFINITY;
    const oldStart = new Date(item.effectiveFrom).getTime();
    const oldEnd = item.effectiveTo ? new Date(item.effectiveTo).getTime() : Number.POSITIVE_INFINITY;
    return newStart <= oldEnd && oldStart <= newEnd;
  }) : [];
  const overlapNames = overlappingPolicies.map((item) => `${item.name} (${item.code})`).join(", ");

  const copy = confirmation?.action === "replace" ? { title: "Thay thế công thức đang áp dụng?", confirmLabel: "Xác nhận thay thế", tone: "warning" as const, impact: `${overlapNames || "Công thức đang áp dụng bị chồng thời gian"} sẽ được kết thúc trước ngày ${String(confirmation.policy.effectiveFrom).slice(0, 10)}; công thức cùng hoặc bắt đầu muộn hơn sẽ được ngưng áp dụng.` }
    : confirmation?.action === "retire" ? { title: "Ngưng áp dụng công thức?", confirmLabel: "Ngưng áp dụng", tone: "danger" as const, impact: "Công thức này sẽ không còn được chọn cho các kỳ lương mới." }
      : confirmation?.action === "delete" ? { title: "Xóa công thức?", confirmLabel: "Xóa công thức", tone: "danger" as const, impact: "Chỉ phiên bản không bị khóa và không được dùng trong kỳ lương đã chốt mới có thể xóa." } : null;

  return <div className="rounded-xl border border-slate-200 bg-white p-4">
    <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-800">Phiên bản công thức lương</h3><p className="text-xs text-slate-500">Bản nháp có thể sửa. Phiên bản thuộc kỳ đã chốt chỉ có thể nhân bản thành phiên bản mới.</p></div>{canManage && <button onClick={() => setEditor({ mode: "create" })} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white"><Plus size={14}/>Tạo công thức</button>}</div>
    <div className="space-y-2">{items.length === 0 ? <p className="text-sm text-slate-400">Chưa có phiên bản cấu hình.</p> : items.map((policy) => <div key={policy._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3"><div><div className="font-semibold text-slate-800">{policy.name} <span className="text-xs font-normal text-slate-400">({policy.code})</span></div><div className="mt-1 text-xs text-slate-500">Hiệu lực: {String(policy.effectiveFrom).slice(0, 10)}{policy.effectiveTo ? ` → ${String(policy.effectiveTo).slice(0, 10)}` : ""} · <span className="font-semibold uppercase">{policy.status}</span></div></div><div className="flex flex-wrap gap-1">{getPayrollPolicyActions(canManage, policy.status).map((action) => { const Icon = icons[action]; return <button key={action} onClick={() => void act(action, policy)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"><Icon size={12}/>{labels[action]}</button>; })}</div></div>)}</div>
    {editor && <PayrollPolicyFormModal mode={editor.mode} initialDefinition={editor.policy ? editableDefinition(editor.policy) : undefined} saving={saving} onCancel={() => setEditor(null)} onSave={save}/>}
    {confirmation && copy && <PayrollPolicyConfirmDialog title={copy.title} description={`${confirmation.policy.name} (${confirmation.policy.code})`} impact={copy.impact} confirmLabel={copy.confirmLabel} tone={copy.tone} pending={confirming} error={confirmationError} onCancel={() => { if (!confirming) setConfirmation(null); }} onConfirm={() => void confirmAction()}/>}
  </div>;
}
