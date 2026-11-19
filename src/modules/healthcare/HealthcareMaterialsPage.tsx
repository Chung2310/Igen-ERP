import { useMemo, useState, type FormEvent } from "react";
import { ArrowDownToLine, ArrowUpFromLine, ClipboardList, Pencil, Plus, RefreshCw } from "lucide-react";
import { ErpModal } from "../../components/common/ErpModal";
import { primaryCreateButtonClass } from "../../components/common/primaryCreateButton";
import type { HealthcareMaterial, HealthcareMaterialMovement, HealthcareMaterialMovementType } from "../../../shared/healthcare";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import type { HealthcareApi } from "./api";
import { buttonClass, Cell, controlClass, Feedback, IconActionButton, messageOf, panelClass, StatusBadge, Table, useHealthcareQuery } from "./ui";

type MaterialList = {
  items: HealthcareMaterial[];
  total: number;
  page: number;
  pageSize: number;
  summary: { activeCount: number; lowStockCount: number };
};
type MovementList = { items: HealthcareMaterialMovement[] };
type MaterialForm = {
  code: string;
  name: string;
  category: string;
  unit: string;
  lotCode: string;
  expiryDate: string;
  minimumQuantity: string;
  unitCost: string;
  supplier: string;
  notes: string;
  status: "active" | "inactive";
};

const emptyForm: MaterialForm = {
  code: "", name: "", category: "", unit: "", lotCode: "", expiryDate: "",
  minimumQuantity: "0", unitCost: "0", supplier: "", notes: "", status: "active",
};
const amount = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 });
const money = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
const movementDateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
const localDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split("-").reverse().join("/") : "—";
const expired = (value: string) => Boolean(value && value < new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10));

export default function HealthcareMaterialsPage({ api, canManage }: { api: HealthcareApi; canManage: boolean }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const params = useMemo(() => new URLSearchParams({ q: debouncedSearch, status, page: String(page), pageSize: "25" }).toString(), [debouncedSearch, status, page]);
  const list = useHealthcareQuery<MaterialList>(api, `/materials?${params}`);
  const [editor, setEditor] = useState<HealthcareMaterial | "create" | null>(null);
  const [form, setForm] = useState<MaterialForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [movement, setMovement] = useState<{ material: HealthcareMaterial; type: HealthcareMaterialMovementType } | null>(null);
  const [movementQuantity, setMovementQuantity] = useState("");
  const [movementCost, setMovementCost] = useState("0");
  const [movementNote, setMovementNote] = useState("");
  const [movementError, setMovementError] = useState("");
  const [submittingMovement, setSubmittingMovement] = useState(false);
  const [historyMaterial, setHistoryMaterial] = useState<HealthcareMaterial | null>(null);
  const movementHistory = useHealthcareQuery<MovementList>(api,
    historyMaterial ? `/materials/${encodeURIComponent(historyMaterial._id)}/movements?limit=50` : null);
  const data = list.data;
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / 25));

  function openCreate() {
    setForm(emptyForm);
    setFormError("");
    setEditor("create");
  }

  function openEdit(material: HealthcareMaterial) {
    setForm({
      code: material.code, name: material.name, category: material.category, unit: material.unit,
      lotCode: material.lotCode || "", expiryDate: material.expiryDate || "",
      minimumQuantity: String(material.minimumQuantity), unitCost: String(material.unitCost),
      supplier: material.supplier || "", notes: material.notes || "", status: material.status,
    });
    setFormError("");
    setEditor(material);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const isNew = editor === "create";
      const path = isNew ? "/materials" : `/materials/${encodeURIComponent(editor!._id)}`;
      const method = isNew ? "POST" : "PATCH";
      const payload = {
        ...form,
        code: form.code.trim().toUpperCase(),
        minimumQuantity: Number(form.minimumQuantity || 0),
        unitCost: Number(form.unitCost || 0),
        ...(isNew ? {} : { revision: editor!.revision }),
      };
      await api.json(path, { method, body: JSON.stringify(payload) });
      setEditor(null);
      setNotice(isNew ? "Đã thêm vật tư." : "Đã cập nhật vật tư.");
      list.refresh();
    } catch (error) {
      setFormError(messageOf(error));
    } finally {
      setSaving(false);
    }
  }

  function openMovement(material: HealthcareMaterial, type: HealthcareMaterialMovementType) {
    setMovement(material ? { material, type } : null);
    setMovementQuantity("");
    setMovementCost(String(material.unitCost || 0));
    setMovementNote("");
    setMovementError("");
  }

  async function submitMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!movement) return;
    setSubmittingMovement(true);
    setMovementError("");
    try {
      await api.json(`/materials/${encodeURIComponent(movement.material._id)}/movements`, {
        method: "POST",
        body: JSON.stringify({
          type: movement.type,
          quantity: Number(movementQuantity),
          unitCost: Number(movementCost || 0),
          note: movementNote.trim(),
        }),
      });
      setMovement(null);
      setNotice(movement.type === "receipt" ? "Đã ghi nhận phiếu nhập vật tư." : "Đã ghi nhận phiếu xuất vật tư.");
      list.refresh();
      if (historyMaterial?._id === movement.material._id) movementHistory.refresh();
    } catch (error) {
      setMovementError(messageOf(error));
    } finally {
      setSubmittingMovement(false);
    }
  }

  return <section className="space-y-4" aria-labelledby="healthcare-materials-title">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 id="healthcare-materials-title" data-typography="page-title" className="text-lg font-semibold text-on-surface text-balance">Vật tư y tế</h1>
        <p className="mt-1 text-sm text-on-surface-variant text-pretty">Theo dõi lô, hạn dùng và nhập xuất vật tư theo chi nhánh.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonClass} onClick={() => list.refresh()} disabled={list.refreshing}>
          <RefreshCw size={16} aria-hidden="true" /> Làm mới
        </button>
        {canManage && <button type="button" className={primaryCreateButtonClass} onClick={openCreate}>
          <Plus size={16} aria-hidden="true" /> Thêm vật tư
        </button>}
      </div>
    </header>

    {notice && <p role="status" className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm">{notice}</p>}
    {data?.summary && <div className="grid gap-3 sm:grid-cols-2">
      <div className={panelClass}><p className="text-xs text-on-surface-variant">Mặt hàng đang dùng</p><p className="mt-1 text-lg font-semibold tabular-nums">{amount.format(data.summary.activeCount)}</p></div>
      <div className={panelClass}><p className="text-xs text-on-surface-variant">Lô cần bổ sung tồn</p><p className="mt-1 text-lg font-semibold tabular-nums">{amount.format(data.summary.lowStockCount)}</p></div>
    </div>}

    <div className={panelClass}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-1">
          <label htmlFor="healthcare-material-search" className="text-xs font-medium text-on-surface-variant">Tìm vật tư</label>
          <input id="healthcare-material-search" type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }}
            placeholder="Mã, tên, lô hoặc nhà cung cấp" className={controlClass} />
        </div>
        <div className="min-w-0 space-y-1">
          <label htmlFor="healthcare-material-status" className="text-xs font-medium text-on-surface-variant">Trạng thái tồn</label>
          <select id="healthcare-material-status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} className={controlClass}>
            <option value="active">Đang sử dụng</option><option value="low-stock">Sắp hết</option>
            <option value="expiring">Sắp hết hạn</option><option value="inactive">Ngừng dùng</option><option value="all">Tất cả</option>
          </select>
        </div>
      </div>
      <div className="mt-4">
        <Feedback loading={list.loading} error={list.error} onRetry={list.refresh} />
        {!list.loading && !list.error && <Table headers={["Vật tư", "Nhóm", "Lô / Hạn dùng", "Tồn kho", "Tối thiểu", "Thao tác"]}
          columnWidths={["25%", "16%", "20%", "14%", "12%", "13%"]} minWidth="880px"
          empty={data?.items.length ? undefined : search || status !== "active"
            ? "Không có vật tư phù hợp. Hãy đổi từ khóa hoặc bộ lọc."
            : canManage ? "Chưa có vật tư. Chọn “Thêm vật tư” để tạo lô đầu tiên." : "Chưa có vật tư trong chi nhánh này."}>
          {data?.items.map(material => <tr key={material._id}>
            <Cell><div className="min-w-36"><span className="font-medium">{material.name}</span><span className="mt-1 block text-xs text-on-surface-variant">{material.code}</span></div></Cell>
            <Cell>{material.category}</Cell>
            <Cell><span>{material.lotCode || "Chưa theo dõi lô"}</span>
              <span className={`mt-1 block text-xs ${expired(material.expiryDate) ? "text-error" : "text-on-surface-variant"}`}>{material.expiryDate ? `HSD ${localDay(material.expiryDate)}` : "Không có hạn dùng"}</span></Cell>
            <Cell><span className="font-medium tabular-nums">{amount.format(material.quantity)} {material.unit}</span>
              {material.quantity <= material.minimumQuantity && material.status === "active" && <span className="mt-1 block"><StatusBadge status="warning" label="Sắp hết" /></span>}</Cell>
            <Cell className="tabular-nums">{amount.format(material.minimumQuantity)} {material.unit}</Cell>
            <Cell align="right"><div className="flex flex-wrap justify-end gap-1.5">
              {canManage && material.status === "active" && <>
                <button type="button" className={buttonClass} onClick={() => openMovement(material, "receipt")} aria-label={`Nhập kho ${material.name}`} title="Nhập kho"><ArrowDownToLine size={16} aria-hidden="true" /></button>
                <button type="button" className={buttonClass} onClick={() => openMovement(material, "issue")} aria-label={`Xuất kho ${material.name}`} title="Xuất kho"><ArrowUpFromLine size={16} aria-hidden="true" /></button>
                <IconActionButton label={`Sửa vật tư ${material.code}`} icon={Pencil} onClick={() => openEdit(material)} />
              </>}
              <IconActionButton label={`Xem lịch sử ${material.code}`} icon={ClipboardList} onClick={() => setHistoryMaterial(material)} />
            </div></Cell>
          </tr>)}
        </Table>}
      </div>
      {data && data.total > 25 && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant pt-3 text-sm">
        <p className="text-on-surface-variant">Trang {page} / {totalPages} · {amount.format(data.total)} lô vật tư</p>
        <div className="flex gap-2">
          <button type="button" className={buttonClass} disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Trước</button>
          <button type="button" className={buttonClass} disabled={page >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))}>Tiếp</button>
        </div>
      </div>}
    </div>

    {editor && <ErpModal native title={editor === "create" ? "Thêm vật tư y tế" : "Cập nhật vật tư y tế"} onClose={() => !saving && setEditor(null)} maxWidth="max-w-2xl">
      <form onSubmit={save} className="space-y-4">
        {formError && <p role="alert" className="rounded-lg border border-error/30 bg-error-container/20 p-3 text-sm text-error">{formError}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><label htmlFor="material-code" className="text-sm font-medium">Mã vật tư *</label><input id="material-code" required maxLength={50} value={form.code} onChange={event => setForm(value => ({ ...value, code: event.target.value }))} className={controlClass} /></div>
          <div className="space-y-1"><label htmlFor="material-name" className="text-sm font-medium">Tên vật tư *</label><input id="material-name" required maxLength={180} value={form.name} onChange={event => setForm(value => ({ ...value, name: event.target.value }))} className={controlClass} /></div>
          <div className="space-y-1"><label htmlFor="material-category" className="text-sm font-medium">Nhóm vật tư *</label><input id="material-category" required maxLength={100} value={form.category} onChange={event => setForm(value => ({ ...value, category: event.target.value }))} className={controlClass} /></div>
          <div className="space-y-1"><label htmlFor="material-unit" className="text-sm font-medium">Đơn vị tính *</label><input id="material-unit" required maxLength={40} placeholder="Hộp, chiếc, ml..." value={form.unit} onChange={event => setForm(value => ({ ...value, unit: event.target.value }))} className={controlClass} /></div>
          <div className="space-y-1"><label htmlFor="material-lot" className="text-sm font-medium">Số lô</label><input id="material-lot" maxLength={80} value={form.lotCode} onChange={event => setForm(value => ({ ...value, lotCode: event.target.value }))} className={controlClass} /></div>
          <div className="space-y-1"><label htmlFor="material-expiry" className="text-sm font-medium">Hạn dùng</label><input id="material-expiry" type="date" value={form.expiryDate} onChange={event => setForm(value => ({ ...value, expiryDate: event.target.value }))} className={controlClass} /></div>
          <div className="space-y-1"><label htmlFor="material-minimum" className="text-sm font-medium">Mức tồn tối thiểu</label><input id="material-minimum" type="number" min="0" step="0.001" value={form.minimumQuantity} onChange={event => setForm(value => ({ ...value, minimumQuantity: event.target.value }))} className={controlClass} /></div>
          <div className="space-y-1"><label htmlFor="material-cost" className="text-sm font-medium">Giá nhập tham khảo</label><input id="material-cost" type="number" min="0" step="1" value={form.unitCost} onChange={event => setForm(value => ({ ...value, unitCost: event.target.value }))} className={controlClass} /></div>
          <div className="space-y-1"><label htmlFor="material-supplier" className="text-sm font-medium">Nhà cung cấp</label><input id="material-supplier" maxLength={180} value={form.supplier} onChange={event => setForm(value => ({ ...value, supplier: event.target.value }))} className={controlClass} /></div>
          <div className="space-y-1"><label htmlFor="material-status" className="text-sm font-medium">Trạng thái</label><select id="material-status" value={form.status} onChange={event => setForm(value => ({ ...value, status: event.target.value as MaterialForm["status"] }))} className={controlClass}><option value="active">Đang sử dụng</option><option value="inactive">Ngừng dùng</option></select></div>
        </div>
        <div className="space-y-1"><label htmlFor="material-notes" className="text-sm font-medium">Ghi chú</label><textarea id="material-notes" rows={3} maxLength={1000} value={form.notes} onChange={event => setForm(value => ({ ...value, notes: event.target.value }))} className={controlClass} /></div>
        <p className="text-xs text-on-surface-variant">Tạo vật tư bắt đầu với tồn kho bằng 0. Dùng phiếu nhập để ghi nhận tồn theo lô.</p>
        <div className="flex flex-wrap justify-end gap-2 border-t border-outline-variant pt-3">
          <button type="button" className={buttonClass} disabled={saving} onClick={() => setEditor(null)}>Hủy</button>
          <button type="submit" className={primaryCreateButtonClass} disabled={saving}>{saving ? "Đang lưu…" : "Lưu vật tư"}</button>
        </div>
      </form>
    </ErpModal>}

    {movement && <ErpModal native title={movement.type === "receipt" ? "Nhập kho vật tư" : "Xuất kho vật tư"} onClose={() => !submittingMovement && setMovement(null)}>
      <form onSubmit={submitMovement} className="space-y-4">
        <div className={panelClass}><p className="font-medium">{movement.material.name}</p><p className="mt-1 text-sm text-on-surface-variant">Tồn hiện tại: <span className="font-medium tabular-nums">{amount.format(movement.material.quantity)} {movement.material.unit}</span></p></div>
        {movementError && <p role="alert" className="rounded-lg border border-error/30 bg-error-container/20 p-3 text-sm text-error">{movementError}</p>}
        <div className="space-y-1"><label htmlFor="material-movement-quantity" className="text-sm font-medium">Số lượng *</label><input id="material-movement-quantity" type="number" required min="0.001" step="0.001" value={movementQuantity} onChange={event => setMovementQuantity(event.target.value)} className={controlClass} /></div>
        {movement.type === "receipt" && <div className="space-y-1"><label htmlFor="material-movement-cost" className="text-sm font-medium">Đơn giá nhập</label><input id="material-movement-cost" type="number" min="0" step="1" value={movementCost} onChange={event => setMovementCost(event.target.value)} className={controlClass} /></div>}
        <div className="space-y-1"><label htmlFor="material-movement-note" className="text-sm font-medium">Ghi chú</label><textarea id="material-movement-note" rows={3} maxLength={500} value={movementNote} onChange={event => setMovementNote(event.target.value)} className={controlClass} /></div>
        <div className="flex justify-end gap-2 border-t border-outline-variant pt-3">
          <button type="button" className={buttonClass} disabled={submittingMovement} onClick={() => setMovement(null)}>Hủy</button>
          <button type="submit" className={primaryCreateButtonClass} disabled={submittingMovement}>{submittingMovement ? "Đang ghi…" : movement.type === "receipt" ? "Ghi phiếu nhập" : "Ghi phiếu xuất"}</button>
        </div>
      </form>
    </ErpModal>}

    {historyMaterial && <ErpModal native title={`Lịch sử tồn · ${historyMaterial.name}`} onClose={() => setHistoryMaterial(null)} maxWidth="max-w-3xl">
      <Feedback loading={movementHistory.loading} error={movementHistory.error} onRetry={movementHistory.refresh} />
      {!movementHistory.loading && !movementHistory.error && <Table headers={["Thời gian", "Loại phiếu", "Số lượng", "Đơn giá", "Người ghi", "Ghi chú"]} minWidth="760px"
        empty={movementHistory.data?.items.length ? undefined : "Vật tư chưa có phiếu nhập hoặc xuất."}>
        {movementHistory.data?.items.map(item => <tr key={item._id}>
          <Cell className="whitespace-nowrap">{movementDateTime.format(new Date(item.createdAt))}</Cell>
          <Cell>{item.type === "receipt" ? "Nhập kho" : "Xuất kho"}</Cell>
          <Cell className="tabular-nums">{amount.format(item.quantity)} {historyMaterial.unit}</Cell>
          <Cell className="tabular-nums">{money.format(item.unitCost)} ₫</Cell>
          <Cell>{item.createdByName || "—"}</Cell><Cell>{item.note || "—"}</Cell>
        </tr>)}
      </Table>}
      <div className="flex justify-end border-t border-outline-variant pt-3"><button type="button" className={buttonClass} onClick={() => setHistoryMaterial(null)}>Đóng</button></div>
    </ErpModal>}
  </section>;
}
