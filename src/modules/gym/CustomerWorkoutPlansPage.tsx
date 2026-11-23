import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { Dropdown } from "./GymDropdown";
import { ErpTableHead } from "../../components/common/ErpTableHead";
import { TablePagination } from "../../components/common/TablePagination";
import { HrStatusBadge } from "../../components/hr/HrStatusBadge";
import type { GymList, GymRecord } from "../../../shared/gym/types";
import type { GymApi } from "./api";
import WorkoutStudio from "./WorkoutStudio";
import { Feedback, messageOf, secondary, useGymQuery } from "./ui";
export default function CustomerWorkoutPlansPage({ api, canWrite }: { api: GymApi; canWrite: boolean }) {
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<GymRecord>();
  const [deleting, setDeleting] = useState<GymRecord>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = () => setRevision(value => value + 1);
  const query = useGymQuery<GymList>(api, `/workout-plans?${new URLSearchParams({ page: String(page), limit: "20", ...(customerId ? { customerId } : {}), ...(status ? { publicationStatus: status } : {}) })}`, revision);
  const customers = useGymQuery<GymList>(api, "/customers?limit=100");
  const names = new Map((customers.data?.data || []).map(customer => [customer._id, customer.fullName]));
  const rows = query.data?.data || [];
  if (editor) return <WorkoutStudio api={api} record={editor} customerId={editor.customerId} onBack={() => setEditor(undefined)} onSaved={() => { setEditor(undefined); refresh(); }} />;
  return <section className="space-y-3 rounded-md border border-outline-variant bg-surface-container-lowest p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold text-on-surface">Giáo án đã giao</h2></div>
    <div className="flex flex-wrap gap-2"><Dropdown aria-label="Lọc theo khách hàng" searchable searchPlaceholder="Tìm tên hoặc SĐT..." value={customerId} onChange={value => { setCustomerId(value); setPage(1); }} options={[["", "Tất cả khách hàng"], ...(customers.data?.data || []).map(item => [item._id, `${item.fullName} — ${item.phone}`])].map(([value, label]) => ({ value, label }))} /><Dropdown aria-label="Lọc trạng thái giáo án" value={status} onChange={value => { setStatus(value); setPage(1); }} options={[["", "Tất cả trạng thái"], ["DRAFT", "Bản nháp"], ["PUBLISHED", "Đã công bố"]].map(([value, label]) => ({ value, label }))} /></div>
    <Feedback loading={query.loading} error={query.error || error} />
    {!query.loading && !query.error && <div className="overflow-x-auto rounded-md border border-outline-variant"><table className="min-w-[740px] w-full text-left text-sm"><ErpTableHead appearance="healthcare" columns={["Giáo án", "Khách hàng", "Trạng thái", "Phiên bản", "Thao tác"]} /><tbody className="divide-y divide-outline-variant">{rows.map(plan => <tr key={plan._id}><td className="px-3 py-2.5 font-medium">{plan.title}</td><td className="px-3 py-2.5">{names.get(plan.customerId) || plan.customerId}</td><td className="px-3 py-2.5"><HrStatusBadge tone={plan.publicationStatus === "PUBLISHED" ? "success" : "warning"}>{plan.publicationStatus === "PUBLISHED" ? "Đã công bố" : "Bản nháp"}</HrStatusBadge>{plan.status === "ARCHIVED" && <span className="ml-2 text-xs text-on-surface-variant">Lịch sử</span>}</td><td className="px-3 py-2.5">v{plan.version || 1}</td><td className="px-3 py-2.5"><div className="flex justify-end gap-1.5">{canWrite && plan.status === "ACTIVE" && <><button type="button" className={secondary} disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await api.request(`/workout-plans/${plan._id}/${plan.publicationStatus === "PUBLISHED" ? "unpublish" : "publish"}`, "PATCH", { revision: plan.revision }); refresh(); } catch (cause) { setError(messageOf(cause)); } finally { setBusy(false); } }}>{plan.publicationStatus === "PUBLISHED" ? "Thu hồi" : "Công bố"}</button><button type="button" className={secondary} onClick={() => setEditor(plan)}><Pencil className="size-3.5" />Sửa</button></>}{canWrite && <button type="button" className={secondary} onClick={() => setDeleting(plan)}><Trash2 className="size-3.5" />Xóa</button>}</div></td></tr>)}{!rows.length && <tr><td colSpan={5} className="p-8 text-center text-on-surface-variant">Chưa có giáo án phù hợp.</td></tr>}</tbody></table></div>}
    {query.data && <TablePagination appearance="erp" currentPage={page} totalPages={query.data.meta.totalPages} totalItems={query.data.meta.total} pageSize={20} pageSizeOptions={[20]} onPageChange={setPage} onPageSizeChange={() => {}} />}
    <ConfirmDialog native appearance="erp" isOpen={Boolean(deleting)} title="Xóa giáo án?" description="Dữ liệu đã xóa không thể khôi phục." confirmLabel="Xóa giáo án" isSubmitting={busy} error={error} onClose={() => setDeleting(undefined)} onConfirm={async () => { if (!deleting) return; setBusy(true); setError(""); try { await api.remove("workout-plans", deleting); setDeleting(undefined); refresh(); } catch (cause) { setError(messageOf(cause)); } finally { setBusy(false); } }} />
  </section>;
}
