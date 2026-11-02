import { useEffect, useRef, useState, type FormEvent } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { apiFetch } from "../../shared/lib/apiFetch";
import { ErpCard, ErpEmptyState, ErpLoadingState, ErpPrimaryButton, erpInputClass } from "../../student-management/components/Erp/ErpUI";

type Partner = { _id: string; code: string; name: string; roles: string[] };
type Policy = { _id: string; partnerId: string; effectiveAt: string; config: { phoneAmount: number; accessoryBps: number; repairBps: number } };
type LegacyPolicy = { _id: string; partnerId: string; kind: "sale" | "repair"; sku: string; ratePercent: number; effectiveFrom?: string; active: boolean };
type Form = { partnerId: string; effectiveAt: string; phoneAmount: string; accessoryPercent: string; repairPercent: string };

const money = (amount: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
const fieldClass = erpInputClass(false);
const initialForm = (): Form => ({ partnerId: "", effectiveAt: "", phoneAmount: "200000", accessoryPercent: "10", repairPercent: "10" });
const localDateTime = (value: string) => new Date(new Date(value).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);

export default function RetailCommissionPoliciesPanel({ companyCode, partners }: { companyCode?: string; partners: Partner[] }) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [legacy, setLegacy] = useState<LegacyPolicy[]>([]);
  const [draft, setDraft] = useState<Policy | "new" | null>(null);
  const [form, setForm] = useState<Form>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const collaborators = partners.filter((partner) => partner.roles.includes("collaborator"));

  async function load() {
    if (!companyCode) return;
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch<{ data: { items: Policy[]; legacy: LegacyPolicy[] } }>("/retail/partners/commission-policies", { params: { companyCode } });
      setPolicies(response.data.items);
      setLegacy(response.data.legacy);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được chính sách hoa hồng.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [companyCode]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (draft && dialog && !dialog.open) dialog.showModal();
  }, [draft]);

  function open(policy?: Policy) {
    setForm(policy ? {
      partnerId: policy.partnerId,
      effectiveAt: localDateTime(policy.effectiveAt),
      phoneAmount: String(policy.config.phoneAmount),
      accessoryPercent: String(policy.config.accessoryBps / 100),
      repairPercent: String(policy.config.repairBps / 100),
    } : initialForm());
    setFormError("");
    setDraft(policy || "new");
  }

  function close() {
    if (saving) return;
    dialogRef.current?.close();
    setDraft(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!companyCode || saving) return;
    setSaving(true);
    setFormError("");
    const editing = draft && draft !== "new" ? draft : null;
    try {
      await apiFetch(`/retail/partners/commission-policies${editing ? `/${editing._id}` : ""}`, {
        method: editing ? "PATCH" : "POST",
        params: { companyCode },
        body: JSON.stringify({
          partnerId: form.partnerId,
          ...(form.effectiveAt ? { effectiveAt: editing && form.effectiveAt === localDateTime(editing.effectiveAt) ? editing.effectiveAt : new Date(`${form.effectiveAt}:00+07:00`).toISOString() } : {}),
          config: {
            phoneAmount: Number(form.phoneAmount),
            accessoryBps: Math.round(Number(form.accessoryPercent) * 100),
            repairBps: Math.round(Number(form.repairPercent) * 100),
          },
        }),
      });
      dialogRef.current?.close();
      setDraft(null);
      setMessage(editing ? "Đã cập nhật chính sách hoa hồng bán lẻ." : "Đã tạo chính sách hoa hồng bán lẻ.");
      await load();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Không lưu được chính sách hoa hồng.");
    } finally {
      setSaving(false);
    }
  }

  return <section aria-labelledby="retail-policies-heading" className="space-y-4">
    <ErpCard className="border-outline-variant p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="retail-policies-heading" className="text-balance text-lg font-semibold text-on-surface">Chính sách hoa hồng</h2>
          <p className="mt-1 text-pretty text-sm text-on-surface-variant">Tạo phiên bản mức chung toàn công ty hoặc mức riêng cho cộng tác viên bán lẻ.</p>
        </div>
        <ErpPrimaryButton type="button" icon={Plus} onClick={() => open()} className="min-h-11 justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Tạo mới</ErpPrimaryButton>
      </div>
      {message && <p role="status" className="mt-4 text-sm text-on-surface-variant">{message}</p>}
      {error ? <p role="alert" className="mt-4 text-sm text-error">{error} <button type="button" onClick={() => void load()} className="font-semibold underline focus-visible:outline-2 focus-visible:outline-primary">Thử lại</button></p>
        : loading ? <div role="status" aria-live="polite"><ErpLoadingState message="Đang tải chính sách hoa hồng..." /></div>
          : policies.length === 0 ? <ErpEmptyState title="Chưa có phiên bản chính sách mới" subtitle="Tạo chính sách chung hoặc chính sách riêng cho cộng tác viên bán lẻ." icon={Plus} />
            : <div className="mt-4 overflow-x-auto rounded-xl border border-outline-variant">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead><tr className="border-b border-outline-variant bg-surface text-on-surface-variant"><th scope="col" className="px-3 py-2.5 font-semibold">Áp dụng cho</th><th scope="col" className="px-3 py-2.5 font-semibold">Hiệu lực từ</th><th scope="col" className="px-3 py-2.5 font-semibold">Điện thoại / máy</th><th scope="col" className="px-3 py-2.5 font-semibold">Phụ kiện</th><th scope="col" className="px-3 py-2.5 font-semibold">Công sửa chữa</th><th scope="col" className="px-3 py-2.5 font-semibold">Thao tác</th></tr></thead>
                <tbody className="divide-y divide-outline-variant text-on-surface">{policies.map((policy) => <tr key={policy._id}>
                  <td className="px-3 py-2.5 font-medium">{policy.partnerId ? collaborators.find((partner) => partner._id === policy.partnerId)?.name || "CTV bán lẻ đã ngừng" : "Toàn công ty"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{new Date(policy.effectiveAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{money(policy.config.phoneAmount)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{policy.config.accessoryBps / 100}%</td>
                  <td className="px-3 py-2.5 tabular-nums">{policy.config.repairBps / 100}%</td>
                  <td className="px-3 py-2.5"><button type="button" onClick={() => open(policy)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><Pencil aria-hidden="true" className="size-4" />Sửa</button></td>
                </tr>)}</tbody>
              </table>
            </div>}
      {!loading && !error && legacy.length > 0 && <section aria-labelledby="retail-legacy-policies-heading" className="mt-5 border-t border-outline-variant pt-4">
        <h3 id="retail-legacy-policies-heading" className="text-balance text-sm font-semibold text-on-surface">Cấu hình hoa hồng cũ</h3>
        <p className="mt-1 text-pretty text-xs text-on-surface-variant">Các mức này tiếp tục áp dụng khi chưa có chính sách phiên bản mới có hiệu lực.</p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-outline-variant"><table className="w-full min-w-[36rem] text-left text-xs"><thead><tr className="border-b border-outline-variant bg-surface text-on-surface-variant"><th scope="col" className="px-3 py-2 font-semibold">CTV bán lẻ</th><th scope="col" className="px-3 py-2 font-semibold">Nguồn</th><th scope="col" className="px-3 py-2 font-semibold">SKU</th><th scope="col" className="px-3 py-2 font-semibold">Tỷ lệ</th><th scope="col" className="px-3 py-2 font-semibold">Trạng thái</th></tr></thead><tbody className="divide-y divide-outline-variant">{legacy.map((item) => <tr key={item._id}><td className="px-3 py-2">{collaborators.find((partner) => partner._id === item.partnerId)?.name || item.partnerId}</td><td className="px-3 py-2">{item.kind === "repair" ? "Sửa chữa" : "Bán sản phẩm"}</td><td className="px-3 py-2">{item.sku}</td><td className="px-3 py-2 tabular-nums">{item.ratePercent}%</td><td className="px-3 py-2">{item.active ? "Đang áp dụng" : "Ngừng áp dụng"}</td></tr>)}</tbody></table></div>
      </section>}
    </ErpCard>

    {draft && <dialog ref={dialogRef} aria-labelledby="retail-policy-dialog-heading" onClose={() => setDraft(null)} onCancel={(event) => { if (saving) event.preventDefault(); }} className="m-auto max-h-[90dvh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 text-on-surface shadow-2xl backdrop:bg-slate-950/60 sm:p-6">
      <form onSubmit={(event) => void save(event)} aria-busy={saving} className="space-y-5">
        <div className="flex items-start justify-between gap-3 border-b border-outline-variant pb-3"><div><h3 id="retail-policy-dialog-heading" className="text-balance text-lg font-semibold">{draft === "new" ? "Tạo chính sách hoa hồng" : "Sửa chính sách hoa hồng"}</h3><p className="mt-1 text-pretty text-sm text-on-surface-variant">Mức theo sản phẩm được thiết lập tại tab Hoa hồng sản phẩm.</p></div><button type="button" aria-label="Đóng chính sách" onClick={close} disabled={saving} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"><X aria-hidden="true" className="size-4" /></button></div>
        {formError && <p role="alert" className="text-sm text-error">{formError}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium">Áp dụng cho<select className={fieldClass} value={form.partnerId} onChange={(event) => setForm((current) => ({ ...current, partnerId: event.target.value }))} disabled={saving}><option value="">Mặc định toàn công ty</option>{collaborators.map((partner) => <option key={partner._id} value={partner._id}>{partner.name} ({partner.code})</option>)}</select></label>
          <label className="grid gap-1 text-sm font-medium">Hiệu lực (để trống = ngay)<input className={fieldClass} type="datetime-local" value={form.effectiveAt} onChange={(event) => setForm((current) => ({ ...current, effectiveAt: event.target.value }))} disabled={saving} /></label>
          <label className="grid gap-1 text-sm font-medium">Điện thoại / máy (VND)<input className={fieldClass} type="number" min="150000" max="300000" step="1000" required value={form.phoneAmount} onChange={(event) => setForm((current) => ({ ...current, phoneAmount: event.target.value }))} disabled={saving} /></label>
          <label className="grid gap-1 text-sm font-medium">Phụ kiện (%)<input className={fieldClass} type="number" min="10" max="15" step="0.01" required value={form.accessoryPercent} onChange={(event) => setForm((current) => ({ ...current, accessoryPercent: event.target.value }))} disabled={saving} /></label>
          <label className="grid gap-1 text-sm font-medium">Công sửa chữa (%)<input className={fieldClass} type="number" min="10" max="15" step="0.01" required value={form.repairPercent} onChange={(event) => setForm((current) => ({ ...current, repairPercent: event.target.value }))} disabled={saving} /></label>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-outline-variant pt-4"><button type="button" onClick={close} disabled={saving} className="min-h-11 rounded-lg border border-outline-variant px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Hủy</button><ErpPrimaryButton type="submit" icon={Plus} disabled={saving} className="min-h-11 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">{saving ? "Đang lưu..." : draft === "new" ? "Lưu phiên bản" : "Cập nhật chính sách"}</ErpPrimaryButton></div>
      </form>
    </dialog>}
  </section>;
}
