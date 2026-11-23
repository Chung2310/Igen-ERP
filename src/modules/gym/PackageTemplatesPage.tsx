import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { ErpRefreshButton } from "../../components/common/ErpRefreshButton";
import { ErpTableHead } from "../../components/common/ErpTableHead";
import { TableFilterToolbar } from "../../components/common/TableFilterToolbar";
import { TablePagination } from "../../components/common/TablePagination";
import { HrStatusBadge } from "../../components/hr/HrStatusBadge";
import { Dropdown } from "./GymDropdown";
import type { GymList, GymRecord } from "../../../shared/gym/types";
import type { GymApi } from "./api";
import { Field, Feedback, FormDialog, GymEmptyState, messageOf, primary, secondary, useGymQuery } from "./ui";

function TemplateEditor({ api, record, onClose, onSaved }: { api: GymApi; record?: GymRecord; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: record?.name || "", totalSessions: record?.totalSessions ?? 12,
    durationDays: record?.durationDays ?? 30, price: record?.price ?? 0,
    status: record?.status || "ACTIVE", description: record?.description || "",
  });
  const update = (key: keyof typeof form, value: string | number) => setForm((current) => ({ ...current, [key]: value }));
  return <FormDialog
    title={record ? "Sửa gói tập mẫu" : "Tạo gói tập mẫu mới"}
    submitLabel={record ? "Lưu thay đổi" : "Tạo gói mẫu"}
    dirty={JSON.stringify(form) !== JSON.stringify({ name: record?.name || "", totalSessions: record?.totalSessions ?? 12, durationDays: record?.durationDays ?? 30, price: record?.price ?? 0, status: record?.status || "ACTIVE", description: record?.description || "" })}
    onClose={onClose}
    onSubmit={async () => {
      await api.save("package-templates", { ...form, name: form.name.trim(), description: form.description.trim() }, record);
      onSaved();
    }}
  >
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><Field label="Tên gói tập mẫu" required value={form.name} onChange={(value) => update("name", value)} placeholder="Ví dụ: Gói PT 1:1 - 12 buổi (1 tháng), Gói Tăng cơ 36 buổi..." /></div>
      <Field label="Tổng số buổi" required type="number" min={1} value={form.totalSessions} onChange={(value) => update("totalSessions", value)} />
      <Field label="Thời hạn sử dụng (ngày)" required type="number" min={1} value={form.durationDays} onChange={(value) => update("durationDays", value)} />
      <Field label="Giá niêm yết (VNĐ)" type="number" min={0} value={form.price} onChange={(value) => update("price", value)} />
      <Field label="Trạng thái áp dụng" value={form.status} options={[["ACTIVE", "Đang kích hoạt (Cho phép PT chọn)"], ["INACTIVE", "Tạm ngưng"]]} onChange={(value) => update("status", value)} />
      <div className="sm:col-span-2"><Field label="Mô tả / Quyền lợi gói tập" multiline value={form.description} onChange={(value) => update("description", value)} placeholder="Ghi chú chi tiết về quyền lợi, đối tượng phù hợp, ưu đãi kèm theo..." /></div>
    </div>
  </FormDialog>;
}

export default function PackageTemplatesPage({ api, canWrite }: { api: GymApi; canWrite: boolean }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState<GymRecord | "new">();
  const [deleting, setDeleting] = useState<GymRecord>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const params = new URLSearchParams({ page: String(page), limit: String(limit), search, status });
  const query = useGymQuery<GymList>(api, `/package-templates?${params}`, refreshKey);
  const refresh = () => setRefreshKey((key) => key + 1);
  return <section className="flex min-h-full flex-col gap-3" aria-label="Quản lý gói tập mẫu">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant pb-2">
      <h2 data-typography="page-title" className="text-lg font-semibold text-on-surface">Quản lý gói tập mẫu</h2>
      {canWrite && <button type="button" className={primary} onClick={() => setEditing("new")}><Plus className="size-4" aria-hidden="true" />Tạo gói mẫu mới</button>}
    </div>
    <div className="flex flex-1 flex-col gap-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3 sm:p-4">
      <TableFilterToolbar
        appearance="plain"
        search={{ value: search, onChange: (value) => { setSearch(value); setPage(1); }, placeholder: "Tìm theo tên gói hoặc mô tả quyền lợi...", ariaLabel: "Tìm gói tập mẫu" }}
        totalCount={query.data?.meta.total}
        countLabel="gói tập mẫu"
        hasActiveFilters={Boolean(search || status)}
        onResetFilters={() => { setSearch(""); setStatus(""); setPage(1); }}
        actions={<ErpRefreshButton loading={query.loading} onClick={refresh} />}
      >
        <Dropdown aria-label="Lọc trạng thái" value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={[["", "Tất cả trạng thái"], ["ACTIVE", "Đang kích hoạt"], ["INACTIVE", "Tạm ngưng"]].map(([value, label]) => ({ value, label }))} />
      </TableFilterToolbar>
      <Feedback loading={query.loading} error={query.error || error} />
      {!query.loading && !query.error && <div className="flex-1 overflow-x-auto rounded-md border border-outline-variant"><table className="min-w-[760px] w-full border-collapse text-left text-sm">
        <ErpTableHead appearance="healthcare" columns={["Tên gói tập mẫu", "Số buổi", "Thời hạn", "Giá niêm yết", "Trạng thái", "Thao tác"]} />
        <tbody className="divide-y divide-outline-variant">
          {(query.data?.data || []).map((item) => <tr key={item._id}>
            <td className="px-3 py-3"><strong className="block font-semibold text-on-surface">{item.name}</strong>{item.description && <span className="block max-w-64 truncate text-xs text-on-surface-variant">{item.description}</span>}</td>
            <td className="px-3 py-3 tabular-nums">{item.totalSessions} buổi</td>
            <td className="px-3 py-3 tabular-nums">{item.durationDays} ngày</td>
            <td className="px-3 py-3 tabular-nums">{item.price ? `${Number(item.price).toLocaleString("vi-VN")} đ` : "Chưa đặt giá"}</td>
            <td className="px-3 py-3 text-center"><HrStatusBadge tone={item.status === "ACTIVE" ? "success" : "neutral"}>{item.status === "ACTIVE" ? "Đang kích hoạt" : "Tạm ngưng"}</HrStatusBadge></td>
            <td className="px-3 py-3"><div className="flex justify-end gap-2">{canWrite && <><button type="button" className={secondary} onClick={() => setEditing(item)}><Pencil className="size-3.5" aria-hidden="true" />Sửa</button><button type="button" className={secondary} onClick={() => setDeleting(item)}><Trash2 className="size-3.5" aria-hidden="true" />Xóa</button></>}</div></td>
          </tr>)}
          {!query.data?.data.length && <tr><td colSpan={6}><GymEmptyState kind="contract" filtered={Boolean(search || status)} title={search || status ? "Không có gói tập mẫu phù hợp." : "Chưa có gói tập mẫu."} /></td></tr>}
        </tbody>
      </table></div>}
      {query.data && <TablePagination appearance="erp" currentPage={page} totalPages={query.data.meta.totalPages} pageSize={limit} totalItems={query.data.meta.total} pageSizeOptions={[12, 20, 50]} onPageChange={setPage} onPageSizeChange={value => { setLimit(value); setPage(1); }} />}
    </div>
    {editing && <TemplateEditor api={api} record={editing === "new" ? undefined : editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); refresh(); }} />}
    <ConfirmDialog native appearance="erp" isOpen={Boolean(deleting)} title="Xóa gói tập mẫu?" description={`Gói PT đã cấp cho khách hàng sẽ không bị ảnh hưởng. ${deleting?.name || ""}`} confirmLabel="Xóa gói mẫu" isSubmitting={busy} error={error} onClose={() => setDeleting(undefined)} onConfirm={async () => { if (!deleting) return; setBusy(true); setError(""); try { await api.remove("package-templates", deleting); setDeleting(undefined); refresh(); } catch (err) { setError(messageOf(err)); } finally { setBusy(false); } }} />
  </section>;
}
