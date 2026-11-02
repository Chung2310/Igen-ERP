import { useEffect, useRef, useState, type FormEvent } from "react";
import { Pencil, X } from "lucide-react";
import { apiFetch } from "../../shared/lib/apiFetch";
import { cn } from "../../student-management/lib/utils";
import type { RetailScope } from "../types";

type RetailPartner = { _id: string; code: string; name: string };
type PolicyKind = "sale" | "repair";
type CommissionPolicy = {
  _id: string;
  partnerId: string;
  kind: PolicyKind;
  sku: string;
  ratePercent: number;
  effectiveFrom?: string;
  active: boolean;
};
type PolicyProduct = { _id: string; sku: string; name: string; variantName: string };
type PolicyForm = { kind: PolicyKind; sku: string; ratePercent: string; effectiveFrom: string; active: boolean };

const fieldClass = "min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60";
const buttonClass = "min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const initialForm = (): PolicyForm => ({ kind: "sale", sku: "", ratePercent: "", effectiveFrom: today(), active: true });

export default function RetailPartnerPolicyDialog({ partner, companyCode, scope, onClose }: {
  partner: RetailPartner | null;
  companyCode?: string;
  scope: RetailScope | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [policies, setPolicies] = useState<CommissionPolicy[]>([]);
  const [products, setProducts] = useState<PolicyProduct[]>([]);
  const [form, setForm] = useState<PolicyForm>(initialForm);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (partner && !dialog.open) dialog.showModal();
    else if (!partner && dialog.open) dialog.close();
  }, [partner]);

  useEffect(() => {
    setPolicies([]);
    setProducts([]);
    setForm(initialForm());
    setEditingKey(null);
    setError("");
    setMessage("");
    if (!partner) return;
    if (!companyCode || !scope) {
      setError("Vui lòng chọn công ty và chi nhánh bán lẻ trước khi cấu hình chính sách.");
      return;
    }

    let active = true;
    setLoading(true);
    void Promise.all([
      apiFetch<{ data: CommissionPolicy[] }>("/retail/finance/commission/policies", { params: scope }),
      apiFetch<{ data: PolicyProduct[] }>("/retail/partners/policy-products", { params: { companyCode } }),
    ]).then(([policyResponse, productResponse]) => {
      if (!active) return;
      setPolicies(policyResponse.data.filter((policy) => policy.partnerId === partner._id));
      setProducts(productResponse.data);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Không tải được chính sách hoa hồng.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [partner?._id, companyCode, scope?.companyCode, scope?.branchId]);

  function clearEditing() {
    setEditingKey(null);
    setForm(initialForm());
    setError("");
    setMessage("");
  }

  function editPolicy(policy: CommissionPolicy) {
    setEditingKey(`${policy.kind}:${policy.sku}`);
    setForm({
      kind: policy.kind,
      sku: policy.sku,
      ratePercent: String(policy.ratePercent),
      effectiveFrom: policy.effectiveFrom?.slice(0, 10) || today(),
      active: policy.active,
    });
    setError("");
    setMessage("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!partner || !scope || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    const sku = form.kind === "repair" ? "*" : form.sku;
    try {
      const response = await apiFetch<{ data: CommissionPolicy }>("/retail/finance/commission/policies", {
        method: "PUT",
        params: scope,
        body: JSON.stringify({
          partnerId: partner._id,
          kind: form.kind,
          sku,
          ratePercent: Number(form.ratePercent),
          effectiveFrom: form.effectiveFrom,
          active: form.active,
        }),
      });
      const savedPolicy = response.data;
      setPolicies((current) => [...current.filter((policy) => policy.kind !== savedPolicy.kind || policy.sku !== savedPolicy.sku), savedPolicy]
        .sort((left, right) => left.kind.localeCompare(right.kind) || left.sku.localeCompare(right.sku)));
      setEditingKey(null);
      setForm(initialForm());
      setMessage(editingKey ? "Đã cập nhật chính sách hoa hồng." : "Đã thêm chính sách hoa hồng.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được chính sách hoa hồng.");
    } finally {
      setSaving(false);
    }
  }

  function close() {
    if (saving) return;
    onClose();
  }

  const getProductLabel = (policy: CommissionPolicy) => {
    if (policy.kind === "repair") return "Sửa chữa";
    if (policy.sku === "*") return "Tất cả sản phẩm";
    const product = products.find((item) => item.sku === policy.sku);
    return product ? `${product.name} · ${product.variantName} (${product.sku})` : policy.sku;
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="retail-partner-policy-title"
      aria-modal="true"
      onClose={onClose}
      onCancel={(event) => { if (saving) event.preventDefault(); }}
      className="m-auto max-h-[90dvh] w-[calc(100vw-2rem)] max-w-5xl overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 text-on-surface shadow-2xl backdrop:bg-slate-950/60 sm:p-5"
    >
      <div className="space-y-4 text-left">
        <header className="flex items-start justify-between gap-3 border-b border-outline-variant pb-3">
          <div>
            <h2 id="retail-partner-policy-title" className="text-balance text-lg font-semibold">Chính sách hoa hồng bán lẻ</h2>
            {partner && <p className="mt-1 text-pretty text-sm text-on-surface-variant">{partner.code} · {partner.name}</p>}
          </div>
          <button type="button" aria-label="Đóng chính sách hoa hồng" onClick={close} disabled={saving} className="flex size-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"><X aria-hidden="true" className="size-4" /></button>
        </header>

        {!scope ? <p role="alert" className="rounded-lg border border-error/30 bg-error-container p-3 text-sm text-on-error-container">{error}</p> : <>
          <section aria-labelledby="retail-partner-policy-form-heading" className="space-y-3">
            <div>
              <h3 id="retail-partner-policy-form-heading" className="text-balance font-semibold">{editingKey ? "Cập nhật chính sách" : "Thêm chính sách"}</h3>
              <p className="mt-1 text-pretty text-sm text-on-surface-variant">Thiết lập hoa hồng sản phẩm cho cộng tác viên bán lẻ theo SKU, nguồn phát sinh và ngày hiệu lực.</p>
            </div>
            <form onSubmit={(event) => void save(event)} aria-busy={saving} className="grid gap-3 rounded-xl border border-outline-variant bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5">
              <label className="grid gap-1 text-sm font-medium">Nguồn hoa hồng<select className={fieldClass} value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as PolicyKind, sku: event.target.value === "repair" ? "*" : current.kind === "repair" ? "" : current.sku }))} disabled={saving || !!editingKey}><option value="sale">Bán sản phẩm</option><option value="repair">Sửa chữa</option></select></label>
              <label className="grid gap-1 text-sm font-medium">Sản phẩm / SKU<select className={fieldClass} value={form.kind === "repair" ? "*" : form.sku} onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))} disabled={saving || form.kind === "repair" || !!editingKey} required={form.kind === "sale"}>
                <option value="">Chọn sản phẩm...</option>
                <option value="*">Tất cả sản phẩm</option>
                {form.sku && form.sku !== "*" && !products.some((product) => product.sku === form.sku) && <option value={form.sku}>{form.sku} (không còn trong danh mục)</option>}
                {products.map((product) => <option key={product._id} value={product.sku}>{product.name} · {product.variantName} ({product.sku})</option>)}
              </select></label>
              <label className="grid gap-1 text-sm font-medium">Tỷ lệ hoa hồng (%)<input className={fieldClass} type="number" min="0" max="100" step="0.01" required value={form.ratePercent} onChange={(event) => setForm((current) => ({ ...current, ratePercent: event.target.value }))} disabled={saving} /></label>
              <label className="grid gap-1 text-sm font-medium">Hiệu lực từ<input className={fieldClass} type="date" required value={form.effectiveFrom} onChange={(event) => setForm((current) => ({ ...current, effectiveFrom: event.target.value }))} disabled={saving} /></label>
              <label className="flex min-h-11 items-center gap-2 self-end text-sm font-medium sm:col-span-2 lg:col-span-1"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} disabled={saving} className="size-4 accent-primary" />Đang áp dụng</label>
              <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-5">
                <button type="submit" disabled={saving || loading} className={buttonClass}>{saving ? "Đang lưu..." : editingKey ? "Cập nhật chính sách" : "Lưu chính sách"}</button>
                {editingKey && <button type="button" disabled={saving} onClick={clearEditing} className="min-h-11 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-sm font-semibold text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60">Hủy sửa</button>}
              </div>
            </form>
            {error && <p role="alert" className="text-sm text-error">{error}</p>}
            {message && <p role="status" className="text-sm text-on-surface-variant">{message}</p>}
          </section>

          <section aria-labelledby="retail-partner-policy-list-heading" className="space-y-3">
            <h3 id="retail-partner-policy-list-heading" className="text-balance font-semibold">Danh sách chính sách</h3>
            {loading ? <p role="status" aria-live="polite" className="text-sm text-on-surface-variant">Đang tải chính sách và sản phẩm...</p> : policies.length === 0 ? <p className="rounded-xl border border-outline-variant bg-surface p-4 text-sm text-on-surface-variant">Đối tác này chưa có chính sách hoa hồng.</p> : <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead><tr className="border-b border-outline-variant text-on-surface-variant"><th scope="col" className="px-3 py-2.5 font-semibold">Nguồn</th><th scope="col" className="px-3 py-2.5 font-semibold">Sản phẩm / SKU</th><th scope="col" className="px-3 py-2.5 text-right font-semibold">Tỷ lệ</th><th scope="col" className="px-3 py-2.5 font-semibold">Hiệu lực</th><th scope="col" className="px-3 py-2.5 font-semibold">Trạng thái</th><th scope="col" className="px-3 py-2.5 text-right font-semibold">Hành động</th></tr></thead>
                <tbody className="divide-y divide-outline-variant">{policies.map((policy) => <tr key={`${policy.kind}:${policy.sku}`}>
                  <td className="px-3 py-2.5">{policy.kind === "sale" ? "Bán sản phẩm" : "Sửa chữa"}</td>
                  <td className="max-w-sm truncate px-3 py-2.5">{getProductLabel(policy)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{policy.ratePercent}%</td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{policy.effectiveFrom?.slice(0, 10) || "—"}</td>
                  <td className="px-3 py-2.5">{policy.active ? "Đang áp dụng" : "Ngừng áp dụng"}</td>
                  <td className="px-3 py-2.5 text-right"><button type="button" onClick={() => editPolicy(policy)} aria-label={`Sửa chính sách ${getProductLabel(policy)}`} disabled={saving} className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 text-xs font-semibold text-on-surface hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50")}><Pencil aria-hidden="true" className="size-3.5" />Sửa</button></td>
                </tr>)}</tbody>
              </table>
            </div>}
          </section>
        </>}

        <footer className="flex justify-end border-t border-outline-variant pt-3"><button type="button" onClick={close} disabled={saving} className="min-h-11 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-sm font-semibold text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60">Đóng</button></footer>
      </div>
    </dialog>
  );
}
