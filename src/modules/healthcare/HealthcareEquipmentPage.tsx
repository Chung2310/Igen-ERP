import { useMemo, useState, type FormEvent } from "react";
import { History, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { ErpModal } from "../../components/common/ErpModal";
import { primaryCreateButtonClass } from "../../components/common/primaryCreateButton";
import type { HealthcareEquipment, HealthcareEquipmentRequest } from "../../../shared/healthcare";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import type { HealthcareApi } from "./api";
import { buttonClass, Cell, controlClass, Feedback, IconActionButton, messageOf, panelClass, primaryClass, StatusBadge, Table, useHealthcareQuery } from "./ui";

type EquipmentList = {
  items: HealthcareEquipment[];
  total: number;
  page: number;
  pageSize: number;
  summary: Record<string, number>;
};
type RequestList = { items: HealthcareEquipmentRequest[]; total: number; page: number; pageSize: number };
type EquipmentForm = { code: string; name: string; category: string; location: string; purchaseDate: string; notes: string; status: "available" | "maintenance" | "retired" };
const emptyForm: EquipmentForm = { code: "", name: "", category: "", location: "", purchaseDate: "", notes: "", status: "available" };
const equipmentStatus: Record<HealthcareEquipment["status"], string> = {
  available: "Sẵn sàng", requested: "Chờ duyệt mượn", "in-use": "Đang sử dụng", maintenance: "Bảo trì", retired: "Ngừng sử dụng",
};
const requestStatus: Record<HealthcareEquipmentRequest["status"], string> = {
  pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối", cancelled: "Đã hủy",
};
const requestType: Record<HealthcareEquipmentRequest["requestType"], string> = { borrow: "Mượn thiết bị", return: "Trả thiết bị" };
const statusTone: Record<HealthcareEquipment["status"], string> = {
  available: "success", requested: "warning", "in-use": "info", maintenance: "warning", retired: "",
};
const localDateTime = (value: string) => {
  if (!value) return "";
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time + 7 * 60 * 60 * 1000).toISOString().slice(0, 16) : "";
};
const equipmentDateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
const dateLabel = (value: string) => {
  if (!value) return "—";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? equipmentDateTime.format(new Date(parsed)) : "—";
};

export default function HealthcareEquipmentPage({ api, canManage, userId }: { api: HealthcareApi; canManage: boolean; userId?: string }) {
  const [view, setView] = useState<"devices" | "requests">("devices");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const equipmentParams = useMemo(() => new URLSearchParams({ q: debouncedSearch, status, page: String(page), pageSize: "25" }).toString(), [debouncedSearch, status, page]);
  const equipment = useHealthcareQuery<EquipmentList>(api, view === "devices" ? `/equipment?${equipmentParams}` : null);
  const requests = useHealthcareQuery<RequestList>(api, view === "requests" ? "/equipment/requests?status=pending&page=1&pageSize=50" : null);
  const [editor, setEditor] = useState<HealthcareEquipment | "create" | null>(null);
  const [form, setForm] = useState<EquipmentForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [borrowEquipment, setBorrowEquipment] = useState<HealthcareEquipment | null>(null);
  const [borrowReason, setBorrowReason] = useState("");
  const [expectedReturnAt, setExpectedReturnAt] = useState("");
  const [borrowError, setBorrowError] = useState("");
  const [submittingBorrow, setSubmittingBorrow] = useState(false);
  const [historyEquipment, setHistoryEquipment] = useState<HealthcareEquipment | null>(null);
  const [decisionRequest, setDecisionRequest] = useState<HealthcareEquipmentRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const [retireCandidate, setRetireCandidate] = useState<HealthcareEquipment | null>(null);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const history = useHealthcareQuery<{ items: HealthcareEquipmentRequest[] }>(api,
    historyEquipment ? `/equipment/${encodeURIComponent(historyEquipment._id)}/history` : null);
  const totalPages = Math.max(1, Math.ceil((equipment.data?.total || 0) / 25));

  function refresh() {
    equipment.refresh();
    requests.refresh();
    history.refresh();
  }

  function openCreate() {
    setForm(emptyForm);
    setFormError("");
    setEditor("create");
  }

  function openEdit(item: HealthcareEquipment) {
    setForm({ code: item.code, name: item.name, category: item.category, location: item.location || "", purchaseDate: item.purchaseDate || "", notes: item.notes || "", status: item.status as EquipmentForm["status"] });
    setFormError("");
    setEditor(item);
  }

  async function saveEquipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const isNew = editor === "create";
      await api.json(isNew ? "/equipment" : `/equipment/${encodeURIComponent(editor!._id)}`, {
        method: isNew ? "POST" : "PATCH",
        body: JSON.stringify({ ...form, code: form.code.trim().toUpperCase(), ...(isNew ? {} : { revision: editor!.revision }) }),
      });
      setEditor(null);
      setNotice(isNew ? "Đã thêm thiết bị." : "Đã cập nhật thiết bị.");
      refresh();
    } catch (error) {
      setFormError(messageOf(error));
    } finally {
      setSaving(false);
    }
  }

  async function submitBorrow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!borrowEquipment) return;
    setSubmittingBorrow(true);
    setBorrowError("");
    try {
      await api.json(`/equipment/${encodeURIComponent(borrowEquipment._id)}/borrow-requests`, {
        method: "POST",
        body: JSON.stringify({
          reason: borrowReason.trim(),
          expectedReturnAt: expectedReturnAt ? new Date(expectedReturnAt).toISOString() : "",
        }),
      });
      setBorrowEquipment(null);
      setBorrowReason("");
      setExpectedReturnAt("");
      setNotice("Đã gửi yêu cầu mượn thiết bị.");
      refresh();
    } catch (error) {
      setBorrowError(messageOf(error));
    } finally {
      setSubmittingBorrow(false);
    }
  }

  async function runRequestAction(path: string, method: string, body: unknown, success: string) {
    setActionError("");
    try {
      await api.json(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      setNotice(success);
      refresh();
    } catch (error) {
      setActionError(messageOf(error));
    }
  }

  async function decideRequest(decision: "approved" | "rejected") {
    if (!decisionRequest) return;
    setDecisionError("");
    try {
      await api.json(`/equipment/requests/${encodeURIComponent(decisionRequest._id)}`, {
        method: "PATCH", body: JSON.stringify({ decision, rejectionReason: decision === "rejected" ? rejectionReason.trim() : "" }),
      });
      setDecisionRequest(null);
      setRejectionReason("");
      setNotice(decision === "approved" ? "Đã duyệt yêu cầu." : "Đã từ chối yêu cầu.");
      refresh();
    } catch (error) {
      setDecisionError(messageOf(error));
    }
  }

  const statusCounts = equipment.data?.summary || {};
  return <section className="space-y-4" aria-labelledby="healthcare-equipment-title">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 id="healthcare-equipment-title" data-typography="page-title" className="text-lg font-semibold text-on-surface text-balance">Thiết bị y tế</h1>
        <p className="mt-1 text-sm text-on-surface-variant text-pretty">Theo dõi tình trạng thiết bị và quy trình mượn, trả theo chi nhánh.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonClass} onClick={refresh} disabled={equipment.refreshing || requests.refreshing}>
          <RefreshCw size={16} aria-hidden="true" /> Làm mới
        </button>
        {canManage && <button type="button" className={primaryCreateButtonClass} onClick={openCreate}><Plus size={16} aria-hidden="true" /> Thêm thiết bị</button>}
      </div>
    </header>

    {notice && <p role="status" className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm">{notice}</p>}
    {actionError && <p role="alert" className="rounded-lg border border-error/30 bg-error-container/20 px-3 py-2 text-sm text-error">{actionError}</p>}
    {view === "devices" && <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
      {(["available", "requested", "in-use", "maintenance", "retired"] as const).map(key => <div key={key} className={panelClass}>
        <p className="text-xs text-on-surface-variant">{equipmentStatus[key]}</p><p className="mt-1 text-lg font-semibold tabular-nums">{statusCounts[key] || 0}</p>
      </div>)}
    </div>}

    <div className="space-y-4">
      <nav aria-label="Điều hướng thiết bị" className="flex flex-wrap gap-2">
        <button type="button" aria-current={view === "devices" ? "page" : undefined} className={view === "devices" ? primaryClass : buttonClass} onClick={() => setView("devices")}>Danh sách thiết bị</button>
        <button type="button" aria-current={view === "requests" ? "page" : undefined} className={view === "requests" ? primaryClass : buttonClass} onClick={() => setView("requests")}>Yêu cầu mượn/trả</button>
      </nav>

      {view === "devices" && <div className={panelClass}>
          <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><label htmlFor="healthcare-equipment-search" className="text-xs font-medium text-on-surface-variant">Tìm thiết bị</label><input id="healthcare-equipment-search" type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Mã, tên, nhóm hoặc vị trí" className={controlClass} /></div>
          <div className="space-y-1"><label htmlFor="healthcare-equipment-status" className="text-xs font-medium text-on-surface-variant">Trạng thái</label><select id="healthcare-equipment-status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} className={controlClass}>
            <option value="all">Tất cả</option><option value="available">Sẵn sàng</option><option value="requested">Chờ duyệt mượn</option><option value="in-use">Đang sử dụng</option><option value="maintenance">Bảo trì</option><option value="retired">Ngừng sử dụng</option>
          </select></div>
        </div>
        <div className="mt-4">
          <Feedback loading={equipment.loading} error={equipment.error} onRetry={equipment.refresh} />
          {!equipment.loading && !equipment.error && <Table headers={["Thiết bị", "Nhóm / Vị trí", "Trạng thái", "Người sử dụng", "Thao tác"]} columnWidths={["25%", "22%", "16%", "20%", "17%"]} minWidth="900px" empty={equipment.data?.items.length ? undefined : search || status !== "all"
            ? "Không có thiết bị phù hợp. Hãy đổi từ khóa hoặc bộ lọc."
            : canManage ? "Chưa có thiết bị. Chọn “Thêm thiết bị” để tạo hồ sơ đầu tiên." : "Chưa có thiết bị trong chi nhánh này."}>
            {equipment.data?.items.map(item => <tr key={item._id}>
              <Cell><div className="min-w-36"><span className="font-medium">{item.name}</span><span className="mt-1 block text-xs text-on-surface-variant">{item.code}</span></div></Cell>
              <Cell>{item.category}<span className="mt-1 block text-xs text-on-surface-variant">{item.location || "Chưa có vị trí"}</span></Cell>
              <Cell><StatusBadge status={statusTone[item.status]} label={equipmentStatus[item.status]} /></Cell>
              <Cell>{item.currentBorrowerName || "—"}{item.expectedReturnAt && <span className="mt-1 block text-xs text-on-surface-variant">Dự kiến trả {dateLabel(item.expectedReturnAt)}</span>}</Cell>
              <Cell align="right"><div className="flex flex-wrap justify-end gap-1.5">
                {item.status === "available" && <button type="button" className={buttonClass} onClick={() => { setBorrowEquipment(item); setBorrowError(""); setBorrowReason(""); setExpectedReturnAt(""); }}>Mượn</button>}
                {item.status === "in-use" && item.currentBorrowerId === userId && <button type="button" className={buttonClass} onClick={() => void runRequestAction(`/equipment/${encodeURIComponent(item._id)}/return-requests`, "POST", {}, "Đã gửi yêu cầu trả thiết bị.")}>Yêu cầu trả</button>}
                {canManage && !["requested", "in-use"].includes(item.status) && <>
                  <IconActionButton label={`Sửa thiết bị ${item.code}`} icon={Pencil} onClick={() => openEdit(item)} />
                  {item.status !== "retired" && <IconActionButton label={`Ngừng sử dụng ${item.code}`} icon={Trash2} tone="danger" onClick={() => setRetireCandidate(item)} />}
                </>}
                <IconActionButton label={`Lịch sử mượn trả ${item.code}`} icon={History} onClick={() => setHistoryEquipment(item)} />
              </div></Cell>
            </tr>)}
          </Table>}
        </div>
        {equipment.data && equipment.data.total > 25 && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant pt-3 text-sm">
          <p className="text-on-surface-variant">Trang {page} / {totalPages} · {equipment.data.total} thiết bị</p>
          <div className="flex gap-2"><button type="button" className={buttonClass} disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Trước</button><button type="button" className={buttonClass} disabled={page >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))}>Tiếp</button></div>
        </div>}
      </div>}

      {view === "requests" && <div className={panelClass}>
        <Feedback loading={requests.loading} error={requests.error} onRetry={requests.refresh} />
        {!requests.loading && !requests.error && <Table headers={["Thiết bị", "Nhân viên", "Yêu cầu", "Lý do", "Trạng thái", "Thao tác"]} columnWidths={["20%", "17%", "17%", "20%", "12%", "14%"]} minWidth="980px" empty={requests.data?.items.length ? undefined : "Không có yêu cầu mượn hoặc trả đang chờ duyệt."}>
          {requests.data?.items.map(request => <tr key={request._id}>
            <Cell><span className="font-medium">{request.equipmentName}</span><span className="mt-1 block text-xs text-on-surface-variant">{request.equipmentCode}</span></Cell>
            <Cell>{request.employeeName}</Cell>
            <Cell>{requestType[request.requestType]}{request.expectedReturnAt && <span className="mt-1 block text-xs text-on-surface-variant">Dự kiến trả {dateLabel(request.expectedReturnAt)}</span>}</Cell>
            <Cell>{request.reason || "—"}</Cell>
            <Cell><StatusBadge status={request.status === "pending" ? "warning" : request.status === "approved" ? "success" : ""} label={requestStatus[request.status]} /></Cell>
            <Cell align="right"><div className="flex flex-wrap justify-end gap-1.5">
              {canManage && request.status === "pending" && <>
                <button type="button" className={primaryClass} onClick={() => void runRequestAction(`/equipment/requests/${encodeURIComponent(request._id)}`, "PATCH", { decision: "approved" }, "Đã duyệt yêu cầu.")}>Duyệt</button>
                <button type="button" className={buttonClass} onClick={() => { setDecisionRequest(request); setRejectionReason(""); setDecisionError(""); }}>Từ chối</button>
              </>}
              {!canManage && request.status === "pending" && request.employeeId === userId && <button type="button" className={buttonClass} onClick={() => void runRequestAction(`/equipment/requests/${encodeURIComponent(request._id)}`, "DELETE", undefined, "Đã hủy yêu cầu.")}>Hủy yêu cầu</button>}
            </div></Cell>
          </tr>)}
        </Table>}
      </div>}
    </div>

    {editor && <ErpModal native title={editor === "create" ? "Thêm thiết bị y tế" : "Cập nhật thiết bị y tế"} onClose={() => !saving && setEditor(null)} maxWidth="max-w-2xl">
      <form onSubmit={saveEquipment} className="space-y-4">
        {formError && <p role="alert" className="rounded-lg border border-error/30 bg-error-container/20 p-3 text-sm text-error">{formError}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><label htmlFor="equipment-code" className="text-sm font-medium">Mã thiết bị *</label><input id="equipment-code" required maxLength={50} value={form.code} onChange={event => setForm(value => ({ ...value, code: event.target.value }))} className={controlClass} /></div>
          <div className="space-y-1"><label htmlFor="equipment-name" className="text-sm font-medium">Tên thiết bị *</label><input id="equipment-name" required maxLength={180} value={form.name} onChange={event => setForm(value => ({ ...value, name: event.target.value }))} className={controlClass} /></div>
          <div className="space-y-1"><label htmlFor="equipment-category" className="text-sm font-medium">Nhóm thiết bị *</label><input id="equipment-category" required maxLength={100} value={form.category} onChange={event => setForm(value => ({ ...value, category: event.target.value }))} className={controlClass} /></div>
          <div className="space-y-1"><label htmlFor="equipment-location" className="text-sm font-medium">Vị trí</label><input id="equipment-location" maxLength={180} value={form.location} onChange={event => setForm(value => ({ ...value, location: event.target.value }))} className={controlClass} /></div>
          <div className="space-y-1"><label htmlFor="equipment-purchase-date" className="text-sm font-medium">Ngày mua</label><input id="equipment-purchase-date" type="date" value={form.purchaseDate} onChange={event => setForm(value => ({ ...value, purchaseDate: event.target.value }))} className={controlClass} /></div>
          <div className="space-y-1"><label htmlFor="equipment-form-status" className="text-sm font-medium">Trạng thái</label><select id="equipment-form-status" value={form.status} onChange={event => setForm(value => ({ ...value, status: event.target.value as EquipmentForm["status"] }))} className={controlClass}><option value="available">Sẵn sàng</option><option value="maintenance">Bảo trì</option>{form.status === "retired" && <option value="retired" disabled>Ngừng sử dụng</option>}</select></div>
        </div>
        <div className="space-y-1"><label htmlFor="equipment-notes" className="text-sm font-medium">Ghi chú</label><textarea id="equipment-notes" rows={3} maxLength={1000} value={form.notes} onChange={event => setForm(value => ({ ...value, notes: event.target.value }))} className={controlClass} /></div>
        <p className="text-xs text-on-surface-variant">Trạng thái thiết bị được cập nhật theo quy trình mượn, trả và bảo trì.</p>
        <div className="flex flex-wrap justify-end gap-2 border-t border-outline-variant pt-3"><button type="button" className={buttonClass} disabled={saving} onClick={() => setEditor(null)}>Hủy</button><button type="submit" className={primaryCreateButtonClass} disabled={saving}>{saving ? "Đang lưu…" : "Lưu thiết bị"}</button></div>
      </form>
    </ErpModal>}

    {borrowEquipment && <ErpModal native title={`Yêu cầu mượn · ${borrowEquipment.name}`} onClose={() => !submittingBorrow && setBorrowEquipment(null)}>
      <form onSubmit={submitBorrow} className="space-y-4">
        {borrowError && <p role="alert" className="rounded-lg border border-error/30 bg-error-container/20 p-3 text-sm text-error">{borrowError}</p>}
        <div className="space-y-1"><label htmlFor="equipment-borrow-reason" className="text-sm font-medium">Mục đích sử dụng *</label><textarea id="equipment-borrow-reason" required maxLength={500} rows={3} value={borrowReason} onChange={event => setBorrowReason(event.target.value)} className={controlClass} /></div>
        <div className="space-y-1"><label htmlFor="equipment-return-date" className="text-sm font-medium">Thời gian dự kiến trả</label><input id="equipment-return-date" type="datetime-local" value={expectedReturnAt} onChange={event => setExpectedReturnAt(event.target.value)} className={controlClass} /></div>
        <div className="flex justify-end gap-2 border-t border-outline-variant pt-3"><button type="button" className={buttonClass} disabled={submittingBorrow} onClick={() => setBorrowEquipment(null)}>Hủy</button><button type="submit" className={primaryCreateButtonClass} disabled={submittingBorrow}>{submittingBorrow ? "Đang gửi…" : "Gửi yêu cầu"}</button></div>
      </form>
    </ErpModal>}

    {decisionRequest && <ErpModal native title="Từ chối yêu cầu thiết bị" onClose={() => setDecisionRequest(null)}>
      <div className="space-y-4">
        <p className="text-sm text-on-surface-variant">{requestType[decisionRequest.requestType]} · {decisionRequest.equipmentName} · {decisionRequest.employeeName}</p>
        {decisionError && <p role="alert" className="rounded-lg border border-error/30 bg-error-container/20 p-3 text-sm text-error">{decisionError}</p>}
        <div className="space-y-1"><label htmlFor="equipment-rejection-reason" className="text-sm font-medium">Lý do từ chối</label><textarea id="equipment-rejection-reason" rows={3} maxLength={500} value={rejectionReason} onChange={event => setRejectionReason(event.target.value)} className={controlClass} /></div>
        <div className="flex justify-end gap-2 border-t border-outline-variant pt-3"><button type="button" className={buttonClass} onClick={() => setDecisionRequest(null)}>Đóng</button><button type="button" className={primaryClass} onClick={() => void decideRequest("rejected")}>Từ chối yêu cầu</button></div>
      </div>
    </ErpModal>}

    {historyEquipment && <ErpModal native title={`Lịch sử mượn trả · ${historyEquipment.name}`} onClose={() => setHistoryEquipment(null)} maxWidth="max-w-3xl">
      <Feedback loading={history.loading} error={history.error} onRetry={history.refresh} />
      {!history.loading && !history.error && <Table headers={["Thời gian", "Nhân viên", "Yêu cầu", "Trạng thái", "Ghi chú"]} minWidth="760px" empty={history.data?.items.length ? undefined : "Thiết bị chưa có lịch sử mượn trả."}>
        {history.data?.items.map(item => <tr key={item._id}><Cell className="whitespace-nowrap">{dateLabel(item.createdAt)}</Cell><Cell>{item.employeeName}</Cell><Cell>{requestType[item.requestType]}</Cell><Cell>{requestStatus[item.status]}{item.rejectionReason && <span className="mt-1 block text-xs text-on-surface-variant">{item.rejectionReason}</span>}</Cell><Cell>{item.reason || "—"}</Cell></tr>)}
      </Table>}
      <div className="flex justify-end border-t border-outline-variant pt-3"><button type="button" className={buttonClass} onClick={() => setHistoryEquipment(null)}>Đóng</button></div>
    </ErpModal>}

    <ConfirmDialog appearance="erp" native isOpen={Boolean(retireCandidate)} title="Ngừng sử dụng thiết bị?"
      description={retireCandidate ? `${retireCandidate.name} sẽ chuyển sang trạng thái ngừng sử dụng và không thể tạo yêu cầu mượn mới.` : ""}
      confirmLabel="Ngừng sử dụng" onClose={() => setRetireCandidate(null)} onConfirm={async () => {
        if (!retireCandidate) return;
        await runRequestAction(`/equipment/${encodeURIComponent(retireCandidate._id)}`, "DELETE", undefined, "Đã ngừng sử dụng thiết bị.");
        setRetireCandidate(null);
      }} />
  </section>;
}
