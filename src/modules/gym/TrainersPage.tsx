import { useMemo, useState } from "react";
import { CheckCircle2, Eye, EyeOff, LayoutGrid, List, Mail, Package, Plus, Search, ShieldCheck, Users } from "lucide-react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { Dropdown } from "./GymDropdown";
import { ErpModal } from "../../components/common/ErpModal";
import { ErpRefreshButton } from "../../components/common/ErpRefreshButton";
import { ErpTableHead } from "../../components/common/ErpTableHead";
import { TablePagination } from "../../components/common/TablePagination";
import { primaryCreateButtonClass } from "../../components/common/primaryCreateButton";
import { HrStatusBadge } from "../../components/hr/HrStatusBadge";
import type { GymTrainer } from "../../../shared/gym/types";
import { cn } from "../student-management/lib/utils";
import type { GymApi } from "./api";
import PackageTemplatesPage from "./PackageTemplatesPage";
import { Feedback, Field, GymAvatar, GymEmptyState, messageOf, secondary, useGymQuery } from "./ui";

export default function TrainersPage({
  api,
  canWrite,
}: {
  api: GymApi;
  canWrite: boolean;
}) {
  const [tab, setTab] = useState<"trainers" | "packages">("trainers");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(18);
  const [selected, setSelected] = useState<GymTrainer>();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<GymTrainer>();
  const [deleting, setDeleting] = useState<GymTrainer>();
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const allQuery = useGymQuery<GymTrainer[]>(api, "/trainers", revision);
  const query = useGymQuery<{ data: GymTrainer[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
    api,
    `/trainers/page?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&status=${roleFilter === "pt" ? "ACTIVE" : roleFilter === "admin" ? "LOCKED" : ""}`,
    revision,
  );
  const trainers = allQuery.data || [];

  const stats = useMemo(() => {
    const ptCount = trainers.filter(t => t.status !== "LOCKED").length;
    const adminCount = trainers.filter(t => t.status === "LOCKED").length;
    return { total: trainers.length, ptCount, adminCount };
  }, [trainers]);

  const filtered = query.data?.data || [];

  return (
    <section className="flex min-h-full flex-1 flex-col gap-3" aria-label="Huấn luyện viên">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant">
        <nav aria-label="Quản trị Gym" className="flex gap-1 overflow-x-auto">
          {([
            ["trainers", "Huấn luyện viên", Users],
            ["packages", "Gói tập mẫu", Package],
          ] as const).map(([key, label, Icon]) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setTab(key)}
                className={cn(
                  "inline-flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-3.5 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
                  active
                    ? "border-primary font-semibold text-primary"
                    : "border-transparent font-medium text-on-surface-variant hover:border-outline-variant hover:text-on-surface",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </nav>
        {tab === "trainers" && (
          <div className="flex flex-wrap items-center gap-2 pb-1.5">
            <ErpRefreshButton loading={query.loading} onClick={() => setRevision(r => r + 1)} />
            <a className={secondary} href="/quan-tri-user">
              Tài khoản
            </a>
            {canWrite && (
              <button
                type="button"
                className={cn(primaryCreateButtonClass, "min-h-9")}
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="size-3.5 stroke-[2.5]" aria-hidden="true" />
                Thêm huấn luyện viên
              </button>
            )}
          </div>
        )}
      </div>

      {tab === "packages" ? (
        <PackageTemplatesPage api={api} canWrite={canWrite} />
      ) : (
        <div className="flex flex-1 flex-col gap-3">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: "Tổng PT", value: String(stats.total), icon: Users, tone: "gym-kpi-icon--primary", valueClass: "text-on-surface" },
              { label: "Đang hoạt động", value: String(stats.ptCount), icon: CheckCircle2, tone: "gym-kpi-icon--success", valueClass: "text-change-up" },
              { label: "Đã khóa", value: String(stats.adminCount), icon: ShieldCheck, tone: "gym-kpi-icon--danger", valueClass: "text-error" },
            ].map(({ label, value, icon: Icon, tone, valueClass }) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 rounded-md border border-outline-variant bg-surface-container-lowest px-4 py-3 shadow-2xs"
              >
                <div className="min-w-0 space-y-1">
                  <dt className="truncate text-xs text-on-surface-variant">{label}</dt>
                  <dd className={cn("text-xl font-semibold tabular-nums", valueClass)}>{value}</dd>
                </div>
                <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-md", tone)} aria-hidden="true">
                  <Icon className="size-4" />
                </span>
              </div>
            ))}
          </dl>

          <div className="flex flex-1 flex-col gap-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3.5 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex min-w-[220px] flex-1 flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1 max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant/60" aria-hidden="true" />
                  <input
                    type="text"
                    aria-label="Tìm theo tên hoặc email"
                    placeholder="Tìm tên, email..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    className="h-9 w-full rounded-md border border-outline-variant bg-surface-container-lowest pl-9 pr-3 text-xs text-on-surface placeholder:text-on-surface-variant/60 outline-none transition focus:border-primary"
                  />
                </div>
                <Dropdown
                  aria-label="Lọc theo vai trò"
                  variant="filter"
                  value={roleFilter}
                  onChange={value => { setRoleFilter(value); setPage(1); }}
                  options={[
                    { value: "", label: "Tất cả trạng thái" },
                    { value: "pt", label: "Đang hoạt động" },
                    { value: "admin", label: "Đã khóa" },
                  ]}
                />
              </div>

              <div className="inline-flex rounded-lg border border-outline-variant bg-surface-container-low/50 p-0.5">
                <button
                  type="button"
                  aria-label="Hiển thị dạng thẻ"
                  aria-pressed={viewMode === "grid"}
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "inline-flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors",
                    viewMode === "grid" ? "bg-surface-container-lowest text-primary shadow-2xs" : "text-on-surface-variant hover:text-on-surface",
                  )}
                >
                  <LayoutGrid className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Hiển thị dạng bảng"
                  aria-pressed={viewMode === "list"}
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "inline-flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors",
                    viewMode === "list" ? "bg-surface-container-lowest text-primary shadow-2xs" : "text-on-surface-variant hover:text-on-surface",
                  )}
                >
                  <List className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <Feedback error={query.error} loading={query.loading} />

            {!query.loading && !query.error && !filtered.length && (
              <GymEmptyState
                kind="worker"
                filtered={Boolean(search.trim() || roleFilter)}
                title="Chưa có nhân sự phù hợp."
              />
            )}

            {!query.loading && !query.error && filtered.length > 0 && viewMode === "grid" && (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map(trainer => (
                  <article
                    key={trainer._id}
                    className="flex flex-col justify-between rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-2xs transition-colors hover:border-primary/40"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          {trainer.avatarUrl ? <img src={trainer.avatarUrl} alt="" className="size-9 rounded-md object-cover" /> : <GymAvatar name={trainer.displayName} />}
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold text-on-surface">{trainer.displayName}</h3>
                            <p className="truncate text-xs text-on-surface-variant">
                              {trainer.phone || "Huấn luyện viên"}
                            </p>
                          </div>
                        </div>
                        <HrStatusBadge tone="info" className="normal-case tabular-nums">
                          {trainer.customerCount} khách
                        </HrStatusBadge>
                      </div>

                      <p className="flex items-center gap-1.5 truncate text-xs text-on-surface-variant">
                        <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{trainer.email || "—"}</span>
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-outline-variant/60 pt-3">
                      <button
                        type="button"
                        onClick={() => setSelected(trainer)}
                        className="inline-flex min-h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container"
                      >
                        <Eye className="size-3.5" aria-hidden="true" />
                        Xem chi tiết
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {!query.loading && !query.error && filtered.length > 0 && viewMode === "list" && (
              <div className="overflow-x-auto rounded-lg border border-outline-variant">
                <table className="min-w-[640px] w-full border-collapse text-left text-sm tabular-nums">
                  <ErpTableHead
                    appearance="healthcare"
                    columns={["Huấn luyện viên", "Email", "Trạng thái", "Khách hàng phụ trách"]}
                  />
                  <tbody className="divide-y divide-outline-variant [&>tr]:transition-colors [&>tr:hover]:bg-surface-container-low/40">
                    {filtered.map(trainer => (
                      <tr key={trainer._id}>
                        <td className="px-3 py-2.5 align-middle">
                          <div className="flex items-center gap-2.5">
                            {trainer.avatarUrl ? <img src={trainer.avatarUrl} alt="" className="size-9 rounded-md object-cover" /> : <GymAvatar name={trainer.displayName} />}
                            <span className="font-medium text-on-surface">{trainer.displayName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 align-middle text-xs text-on-surface-variant">{trainer.email}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                          <HrStatusBadge tone={trainer.status === "LOCKED" ? "danger" : "success"} className="normal-case">
                            {trainer.status === "LOCKED" ? "Đã khóa" : "Đang hoạt động"}
                          </HrStatusBadge>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 align-middle font-semibold text-on-surface">
                          {trainer.customerCount} khách hàng
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {query.data && <TablePagination appearance="erp" currentPage={page} totalPages={query.data.meta.totalPages} totalItems={query.data.meta.total} pageSize={limit} pageSizeOptions={[18, 36, 72]} itemLabel="PT" onPageChange={setPage} onPageSizeChange={value => { setLimit(value); setPage(1); }} />}
          </div>
        </div>
      )}

      {selected && (
        <ErpModal native title={selected.displayName} onClose={() => setSelected(undefined)} maxWidth="max-w-lg">
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              {selected.avatarUrl ? <img src={selected.avatarUrl} alt="" className="size-9 rounded-md object-cover" /> : <GymAvatar name={selected.displayName} />}
              <div>
                <p className="font-semibold text-on-surface">{selected.displayName}</p>
                <p className="text-xs text-on-surface-variant">{selected.email || "—"}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-2.5 border-t border-outline-variant pt-3 text-xs">
              <div className="rounded-lg border border-outline-variant p-2.5">
                <dt className="text-on-surface-variant">Trạng thái</dt>
                <dd className="mt-1 font-semibold text-on-surface">
                  {selected.status === "LOCKED" ? "Đã khóa" : "Đang hoạt động"}
                </dd>
              </div>
              <div className="rounded-lg border border-outline-variant p-2.5">
                <dt className="text-on-surface-variant">Khách hàng phụ trách</dt>
                <dd className="mt-1 font-semibold tabular-nums text-primary">{selected.customerCount} khách</dd>
              </div>
              <div className="rounded-lg border border-outline-variant p-2.5">
                <dt className="text-on-surface-variant">Số điện thoại</dt>
                <dd className="mt-1 font-semibold text-on-surface">{selected.phone || "—"}</dd>
              </div>
              <div className="rounded-lg border border-outline-variant p-2.5">
                <dt className="text-on-surface-variant">Email đăng nhập</dt>
                <dd className="mt-1 truncate font-semibold text-on-surface">{selected.email || "—"}</dd>
              </div>
            </dl>
            {canWrite && (
              <div className="flex justify-end gap-2 border-t border-outline-variant pt-3">
                <button
                  type="button"
                  className={secondary}
                  onClick={() => {
                    setEditing(selected);
                    setSelected(undefined);
                  }}
                >
                  Sửa thông tin
                </button>
                <button
                  type="button"
                  className={secondary}
                  onClick={() => {
                    setDeleting(selected);
                    setSelected(undefined);
                  }}
                >
                  Xóa PT
                </button>
              </div>
            )}
          </div>
        </ErpModal>
      )}
      {createOpen && (
        <CreateTrainerModal
          api={api}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            setRevision(r => r + 1);
          }}
        />
      )}
      {editing && <CreateTrainerModal api={api} record={editing} onClose={() => setEditing(undefined)} onCreated={() => { setEditing(undefined); setRevision(r => r + 1); }} />}
      <ConfirmDialog native appearance="erp" isOpen={Boolean(deleting)} title="Xóa huấn luyện viên?" description="PT còn học viên phụ trách cần được điều chuyển trước khi xóa." confirmLabel="Xóa PT" isSubmitting={deleteBusy} error={deleteError} onClose={() => { if (!deleteBusy) setDeleting(undefined); }} onConfirm={async () => { if (!deleting) return; setDeleteBusy(true); setDeleteError(""); try { await api.request(`/trainers/${deleting._id}`, "DELETE"); setDeleting(undefined); setRevision(r => r + 1); } catch (cause) { setDeleteError(messageOf(cause)); } finally { setDeleteBusy(false); } }} />
    </section>
  );
}

function CreateTrainerModal({
  api,
  record,
  onClose,
  onCreated,
}: {
  api: GymApi;
  record?: GymTrainer;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [displayName, setDisplayName] = useState(record?.displayName || "");
  const [email, setEmail] = useState(record?.email || "");
  const [phone, setPhone] = useState(record?.phone || "");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [status, setStatus] = useState(record?.status || "ACTIVE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.request(record ? `/trainers/${record._id}` : "/trainers", record ? "PATCH" : "POST", {
        displayName: displayName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        ...(!record ? { password } : { revision: record.revision }),
        status,
      });
      onCreated();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ErpModal
      native
      title={record ? "Sửa thông tin huấn luyện viên" : "Thêm huấn luyện viên mới"}
      onClose={() => { if (!busy) onClose(); }}
      closeDisabled={busy}
      maxWidth="max-w-lg"
    >
      <form className="space-y-3" onSubmit={handleSubmit} aria-busy={busy}>
        <Field
          label="Họ tên huấn luyện viên"
          required
          value={displayName}
          onChange={setDisplayName}
          disabled={busy}
          placeholder="VD: Nguyễn Văn A"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Email đăng nhập"
            type="email"
            required
            value={email}
            onChange={setEmail}
            disabled={busy}
            placeholder="pt@congty.vn"
          />
          <Field
            label="Số điện thoại"
            value={phone}
            onChange={setPhone}
            disabled={busy}
            placeholder="0912345678"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {!record && <div className="space-y-1">
            <label className="block text-sm text-on-surface">
              Mật khẩu ban đầu <span className="text-error">*</span>
            </label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                required
                minLength={6}
                disabled={busy}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                className="h-9 w-full rounded-md border border-outline-variant bg-surface-container-lowest pl-3 pr-9 text-sm text-on-surface outline-none transition focus:border-primary"
              />
              <button
                type="button"
                aria-label={showPwd ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-on-surface-variant hover:text-on-surface"
              >
                {showPwd ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
              </button>
            </div>
          </div>}
          <Field
            label="Trạng thái tài khoản"
            value={status}
            disabled={busy}
            options={[
              ["ACTIVE", "Hoạt động (ACTIVE)"],
              ["LOCKED", "Tạm khóa (LOCKED)"],
            ]}
            onChange={setStatus}
          />
        </div>
        <Feedback error={error} />
        <div className="flex justify-end gap-2 border-t border-outline-variant pt-3">
          <button type="button" className={secondary} disabled={busy} onClick={onClose}>
            Hủy
          </button>
          <button type="submit" disabled={busy} className={cn(primaryCreateButtonClass, "min-h-9")}>
            <Plus className="size-3.5 stroke-[2.5]" aria-hidden="true" />
            {busy ? "Đang lưu..." : record ? "Lưu thay đổi" : "Tạo huấn luyện viên"}
          </button>
        </div>
      </form>
    </ErpModal>
  );
}
