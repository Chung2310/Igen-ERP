import { useEffect, useState } from "react";
import { Copy, Pencil, Plus, Power, PowerOff, Settings2, Trash2 } from "lucide-react";
import { toast } from "../../../pages/Toast";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import { payrollService } from "../../../services/payrollService";
import { PayrollPolicyConfirmDialog } from "./PayrollPolicyConfirmDialog";
import { PayrollPolicyFormModal } from "./PayrollPolicyFormModal";
import type { PayrollPolicyDefinition } from "./payrollPolicyForm";
import { getPayrollPolicyActions, type PayrollPolicyAction } from "./payrollPolicyActions";
import { canRecalculateAfterPolicySave } from "./payrollPolicySaveDecision";

const editableDefinition = (policy: any) => Object.fromEntries(Object.entries(policy).filter(([key]) => !["_id", "companyCode", "status", "createdBy", "activatedBy", "activatedAt", "retiredBy", "createdAt", "updatedAt", "version", "__v"].includes(key)));
const formatEffectiveDate = (value: unknown) => {
  const raw = String(value ?? "").slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : raw;
};
const labels: Record<PayrollPolicyAction, string> = { edit: "Sửa", clone: "Nhân bản", activate: "Áp dụng", retire: "Ngưng áp dụng", delete: "Xóa" };
const icons = { edit: Pencil, clone: Copy, activate: Power, retire: PowerOff, delete: Trash2 };
const actionColors: Record<PayrollPolicyAction, string> = {
  edit: "bg-[#397FC4] text-white hover:bg-[#2872B9]",
  clone: "bg-[#118E7D] text-white hover:bg-[#087E6E]",
  activate: "bg-[#118E7D] text-white hover:bg-[#087E6E]",
  retire: "bg-[#CD7728] text-white hover:bg-[#B9651E]",
  delete: "bg-[#D8586B] text-white hover:bg-[#C5485B]",
};
type Editor = { mode: "create" | "edit" | "clone"; policy?: any };
type Confirmation = { action: "replace" | "retire" | "delete"; policy: any };
type PendingActiveEdit = { policy: any; definition: PayrollPolicyDefinition };

export function PayrollPolicyManager({ canManage, onPoliciesChanged, runStatus, onRecalculate }: { canManage: boolean; onPoliciesChanged?: () => void | Promise<void>; runStatus?: string; onRecalculate?: () => Promise<void> }) {
  const [items, setItems] = useState<any[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmationError, setConfirmationError] = useState("");
  const [pendingActiveEdit, setPendingActiveEdit] = useState<PendingActiveEdit | null>(null);
  const load = async () => { try { setItems(await payrollService.getPolicies()); } catch (error) { toast.error(error instanceof Error ? error.message : "Không thể tải công thức lương"); } };
  useEffect(() => { void load(); }, []);

  const save = async (definition: PayrollPolicyDefinition) => {
    if (editor?.mode === "edit" && editor.policy.status === "active") {
      setPendingActiveEdit({ policy: editor.policy, definition }); setEditor(null); return;
    }
    setSaving(true);
    try {
      if (editor?.mode === "edit") await payrollService.updatePolicy(editor.policy._id, { ...definition, expectedVersion: editor.policy.version });
      else if (editor?.mode === "clone") await payrollService.clonePolicy(editor.policy._id, { code: definition.code, name: definition.name, definition });
      else await payrollService.createPolicy(definition);
      toast.success(editor?.mode === "edit" ? "Đã cập nhật bản nháp" : editor?.mode === "clone" ? "Đã nhân bản công thức" : "Đã tạo công thức nháp");
      setEditor(null); await load(); await onPoliciesChanged?.();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Không thể lưu công thức lương"); }
    finally { setSaving(false); }
  };

  const saveActiveEdit = async (recalculate: boolean) => {
    if (!pendingActiveEdit) return;
    setSaving(true); setConfirmationError("");
    try {
      await payrollService.updatePolicy(pendingActiveEdit.policy._id, { ...pendingActiveEdit.definition, expectedVersion: pendingActiveEdit.policy.version });
      await load(); await onPoliciesChanged?.(); setPendingActiveEdit(null);
      if (recalculate && onRecalculate) {
        try { await onRecalculate(); toast.success("Đã lưu công thức và cập nhật bảng lương"); }
        catch { toast.error("Đã lưu công thức nhưng chưa thể cập nhật bảng lương. Hãy bấm Cập nhật bảng lương để thử lại."); }
      } else toast.success("Đã lưu cấu hình công thức");
    } catch (error) { setConfirmationError(getApiErrorMessage(error, "Không thể lưu công thức lương")); }
    finally { setSaving(false); }
  };

  const act = async (action: PayrollPolicyAction, policy: any) => {
    if (action === "edit") { setEditor({ mode: "edit", policy }); return; }
    if (action === "clone") { setEditor({ mode: "clone", policy }); return; }
    if (action === "retire" || action === "delete") { setConfirmation({ action, policy }); setConfirmationError(""); return; }
    try {
      await payrollService.activatePolicy(policy._id);
      toast.success("Đã áp dụng công thức lương"); await load(); await onPoliciesChanged?.();
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
      setConfirmation(null); await load(); await onPoliciesChanged?.();
    } catch (error) { setConfirmationError(getApiErrorMessage(error, "Không thể cập nhật công thức lương")); }
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

  const copy = confirmation?.action === "replace" ? { title: "Thay thế công thức đang áp dụng?", confirmLabel: "Xác nhận thay thế", tone: "warning" as const, impact: `${overlapNames || "Công thức đang áp dụng bị chồng thời gian"} sẽ được kết thúc trước ngày ${formatEffectiveDate(confirmation.policy.effectiveFrom)}; công thức cùng hoặc bắt đầu muộn hơn sẽ được ngưng áp dụng.` }
    : confirmation?.action === "retire" ? { title: "Ngưng áp dụng công thức?", confirmLabel: "Ngưng áp dụng", tone: "danger" as const, impact: "Công thức này sẽ không còn được chọn cho các kỳ lương mới." }
      : confirmation?.action === "delete" ? { title: "Xóa công thức?", confirmLabel: "Xóa công thức", tone: "danger" as const, impact: "Chỉ phiên bản không bị khóa và không được dùng trong kỳ lương đã chốt mới có thể xóa." } : null;

  return <div className="rounded-2xl bg-white p-3 shadow-[0_2px_16px_rgba(33,84,123,0.07)]">
    <div className="flex items-start gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D9EEFF] text-[#087BDF]" aria-hidden="true"><Settings2 size={18} /></span>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium text-[#15396C]">Cách tính lương</h3>{canManage && <button onClick={() => setEditor({ mode: "create" })} className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#087BDF] px-3 text-xs font-medium text-white transition-colors hover:bg-[#006CC6]"><Plus size={14}/>Tạo cách tính</button>}</div>
        <div className="space-y-2">{items.length === 0 ? <p className="rounded-xl bg-[#E8F6FF] px-3 py-2 text-sm text-slate-500">Chưa có công thức lương.</p> : items.map((policy) => <div key={policy._id} data-policy-status={policy.status} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 ${policy.status === "active" ? "bg-[#E5F4FD]" : "bg-[#F5F8FC]"}`}><div><div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[#15396C]">{policy.name}{policy.status === "active" && <span className="rounded-full bg-[#CEEAFE] px-2 py-0.5 text-[11px] font-normal text-[#087BDF]">Đang áp dụng</span>}</div><div className="mt-0.5 text-xs text-[#536B8F]">Áp dụng: {formatEffectiveDate(policy.effectiveFrom)}{policy.effectiveTo ? ` → ${formatEffectiveDate(policy.effectiveTo)}` : ""}</div></div><div className="flex flex-wrap gap-1.5">{getPayrollPolicyActions(canManage, policy.status).map((action) => { const Icon = icons[action]; return <button key={action} onClick={() => void act(action, policy)} className={`inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium transition-colors ${actionColors[action]}`}><Icon size={12}/>{labels[action]}</button>; })}</div></div>)}</div>
      </div>
    </div>
    {editor && <PayrollPolicyFormModal mode={editor.mode} initialDefinition={editor.policy ? editableDefinition(editor.policy) : undefined} saving={saving} onCancel={() => setEditor(null)} onSave={save}/>}
    {confirmation && copy && <PayrollPolicyConfirmDialog title={copy.title} description={confirmation.policy.name} impact={copy.impact} confirmLabel={copy.confirmLabel} tone={copy.tone} pending={confirming} error={confirmationError} onCancel={() => { if (!confirming) setConfirmation(null); }} onConfirm={() => void confirmAction()}/>}
    {pendingActiveEdit && <PayrollPolicyConfirmDialog title="Lưu thay đổi công thức đang áp dụng?" description={pendingActiveEdit.policy.name} impact={canRecalculateAfterPolicySave(runStatus) ? "Bạn có thể lưu công thức hoặc cập nhật bảng lương kỳ này." : "Kỳ này đã qua bước kiểm tra nên chỉ có thể lưu công thức."} confirmLabel="Chỉ lưu" secondaryLabel={canRecalculateAfterPolicySave(runStatus) && onRecalculate ? "Lưu và cập nhật lương" : undefined} tone="warning" pending={saving} error={confirmationError} onCancel={() => { if (!saving) setPendingActiveEdit(null); }} onConfirm={() => void saveActiveEdit(false)} onSecondary={() => void saveActiveEdit(true)}/>}
  </div>;
}
