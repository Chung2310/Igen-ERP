import { useState, type ReactNode } from "react";
import { Eye, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { Dropdown } from "./GymDropdown";
import { ErpModal } from "../../components/common/ErpModal";
import { ErpRefreshButton } from "../../components/common/ErpRefreshButton";
import { ErpTableHead } from "../../components/common/ErpTableHead";
import { primaryCreateButtonClass } from "../../components/common/primaryCreateButton";
import { TableFilterToolbar } from "../../components/common/TableFilterToolbar";
import { TablePagination } from "../../components/common/TablePagination";
import { HrStatusBadge } from "../../components/hr/HrStatusBadge";
import type { GymEntity, GymList, GymRecord } from "../../../shared/gym/types";
import { cn } from "../student-management/lib/utils";
import type { GymApi } from "./api";
import { labels, forms } from "./forms";
import CustomerForm from "./CustomerForm";
import RecordEditor from "./RecordEditor";
import SessionDetail from "./SessionDetail";
import {
  dateLabel,
  Feedback,
  GymAvatar,
  GymEmptyState,
  messageOf,
  panel,
  secondary,
  useGymQuery,
} from "./ui";
import type { HrEmptyIllustrationKind } from "../../components/hr/HrEmptyIllustration";

const entityEmptyKind: Partial<Record<GymEntity, HrEmptyIllustrationKind>> = {
  customers: "worker",
  exercises: "training",
  "workout-templates": "training",
  "workout-plans": "training",
  "nutrition-plans": "task",
  "nutrition-logs": "calendar",
  measurements: "task",
  goals: "project",
  roadmaps: "workflow",
  sessions: "calendar",
  packages: "contract",
  transfers: "workflow",
  knowledge: "training",
};

const iconActionClass =
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors hover:border-primary/40 hover:bg-surface-container hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary";

const dangerIconActionClass =
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-error/30 bg-surface-container-lowest text-error transition-colors hover:bg-error-container/30 focus-visible:outline-2 focus-visible:outline-primary";

const createLabels: Partial<Record<GymEntity, string>> = {
  customers: "Tạo mới",
  exercises: "Thêm bài tập",
  "workout-templates": "Tạo giáo án",
  "workout-plans": "Tạo giáo án",
  "nutrition-plans": "Tạo thực đơn",
  "nutrition-logs": "Ghi nhật ký",
  measurements: "Nhập chỉ số",
  goals: "Thêm mục tiêu",
  roadmaps: "Tạo lộ trình",
  sessions: "Ghi buổi tập",
  packages: "Thêm gói PT",
  knowledge: "Thêm tài liệu",
};

const statusBadgeMap: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  ACTIVE: { label: "Đang hoạt động", tone: "success" },
  INACTIVE: { label: "Ngừng hoạt động", tone: "neutral" },
  LEAD: { label: "Tiềm năng", tone: "warning" },
  DRAFT: { label: "Bản nháp", tone: "warning" },
  PUBLISHED: { label: "Đã công bố", tone: "success" },
  ARCHIVED: { label: "Đã lưu trữ", tone: "neutral" },
  EXPIRED: { label: "Hết hạn", tone: "danger" },
  COMPLETED: { label: "Hoàn thành", tone: "info" },
  CANCELLED: { label: "Đã hủy", tone: "danger" },
  PRESENT: { label: "Có mặt", tone: "success" },
  ABSENT: { label: "Vắng", tone: "danger" },
  LATE: { label: "Đi muộn", tone: "warning" },
};

export default function RecordsPage({
  api,
  entity,
  customerId,
  canWrite = true,
  admin = false,
  headerLeft,
  toolbarActions,
  onCustomer,
  extraActions,
}: {
  api: GymApi;
  entity: GymEntity;
  customerId?: string;
  canWrite?: boolean;
  admin?: boolean;
  embedded?: boolean;
  headerLeft?: ReactNode;
  toolbarActions?: ReactNode;
  onCustomer?: (record: GymRecord) => void;
  extraActions?: (record: GymRecord, refresh: () => void) => ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<GymRecord | "new">();
  const [detail, setDetail] = useState<GymRecord>();
  const [deleting, setDeleting] = useState<GymRecord>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = () => setRevision((v) => v + 1);
  const query = new URLSearchParams({
    search,
    status,
    page: String(page),
    limit: String(limit),
    ...(customerId ? { customerId } : {}),
  });
  const result = useGymQuery<GymList>(api, `/${entity}?${query}`, revision);
  const detailCustomer = useGymQuery<GymRecord>(
    api,
    entity === "goals" && detail?.customerId && !detail?.customerName
      ? `/customers/${detail.customerId}`
      : "",
    0,
  );
  const columns =
    entity === "goals"
      ? [["title", "Mục tiêu"], ["customerId", "Khách hàng"], ["type", "Loại"], ["deadline", "Thời hạn"], ["status", "Trạng thái"]]
      : entity === "knowledge"
      ? [["title", "Tiêu đề"], ["topic", "Chủ đề"], ["ragChunkCount", "Đoạn RAG"], ["status", "Trạng thái"]]
      : entity === "customers"
      ? [
          ["fullName", "Họ tên"],
          ["phone", "Số điện thoại"],
          ["email", "Email"],
          ["status", "Trạng thái"],
        ]
      : (forms[entity] || [])
          .filter((f) => !f.multiline)
          .slice(0, 4)
          .map((f) => [f.key, f.label]);

  const display = (row: GymRecord, key: string) => {
    const value = row[key];
    if (entity === "goals" && key === "customerId") {
      if (!row.customerName && !row.customerPhone) return "—";
      return (
        <div className="min-w-0">
          <div className="truncate font-medium text-on-surface">{row.customerName || "—"}</div>
          {row.customerPhone && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-on-surface-variant">
              <Phone className="size-3 shrink-0 text-primary" aria-hidden="true" />
              <span>{row.customerPhone}</span>
            </div>
          )}
        </div>
      );
    }
    if (entity === "goals" && key === "type") return ({ WEIGHT_LOSS: "Giảm cân", FAT_LOSS: "Giảm mỡ", WEIGHT_GAIN: "Tăng cân", MUSCLE_GAIN: "Tăng cơ", RECOMPOSITION: "Tái cấu trúc", FITNESS: "Thể lực" } as Record<string, string>)[value] || value || "—";
    if (entity === "knowledge" && key === "ragChunkCount") return value == null ? "Chưa lập chỉ mục" : `${value} đoạn`;
    if (key === "status" || key === "attendance") {
      const meta = statusBadgeMap[value];
      if (meta) {
        return <HrStatusBadge dot tone={meta.tone}>{meta.label}</HrStatusBadge>;
      }
      return value || "—";
    }
    if (forms[entity]?.some((f) => f.key === key && f.type?.startsWith("date")))
      return dateLabel(value);
    return value == null || value === "" ? "—" : String(value);
  };

  const actionButtons = (
    <>
      {toolbarActions}
      <ErpRefreshButton loading={result.loading} onClick={refresh} />
      {canWrite && (
        <button
          type="button"
          className={cn(primaryCreateButtonClass, "min-h-9")}
          onClick={() => setEditor("new")}
        >
          <Plus className="size-3.5 stroke-[2.5]" aria-hidden="true" />
          {createLabels[entity] || "Tạo mới"}
        </button>
      )}
    </>
  );

  return (
    <section className="flex min-h-full flex-1 flex-col gap-3" aria-label={labels[entity]}>
      {headerLeft && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant">
          {headerLeft}
          <div className="flex flex-wrap items-center gap-2 pb-1.5">
            {actionButtons}
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3 sm:p-4">
        <TableFilterToolbar
          appearance="plain"
          actions={!headerLeft ? actionButtons : undefined}
          search={{
            value: search,
            onChange: (value) => {
              setSearch(value);
              setPage(1);
            },
            placeholder:
              entity === "customers"
                ? "Tìm theo tên, SĐT, mục tiêu..."
                : `Tìm ${labels[entity].toLocaleLowerCase("vi")}...`,
            ariaLabel: "Tìm kiếm",
            className: "min-w-0",
          }}
          totalCount={result.data?.meta.total}
          countLabel="bản ghi"
          hasActiveFilters={Boolean(search.trim() || status)}
          onResetFilters={() => {
            setSearch("");
            setStatus("");
            setPage(1);
          }}
        >
          {entity === "goals" && (
            <Dropdown aria-label="Lọc trạng thái công bố" variant="filter" value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={[["", "Tất cả trạng thái"], ["DRAFT", "Bản nháp"], ["PUBLISHED", "Đã công bố"]].map(([value, label]) => ({ value, label }))} />
          )}
          {entity === "customers" && (
            <Dropdown
              aria-label="Lọc trạng thái khách hàng"
              variant="filter"
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={[
                { value: "", label: "Tất cả trạng thái" },
                { value: "ACTIVE", label: "Đang hoạt động" },
                { value: "INACTIVE", label: "Ngừng hoạt động" },
                { value: "LEAD", label: "Tiềm năng" },
              ]}
            />
          )}
        </TableFilterToolbar>

        <Feedback error={result.error || error} loading={result.loading} />
        {!result.loading && !result.error && (
          <div className="flex-1 overflow-x-auto rounded-md border border-outline-variant">
            <table className="min-w-[740px] w-full border-collapse text-left text-sm tabular-nums">
              <ErpTableHead
                appearance="healthcare"
                columns={[...columns.map(([, label]) => label), "Thao tác"]}
              />
              <tbody className="divide-y divide-outline-variant [&>tr]:transition-colors [&>tr:hover]:bg-surface-container-low/40">
                {result.data?.data.map((row) => (
                  <tr key={row._id}>
                    {columns.map(([key]) => (
                      <td key={key} className={cn("px-3 py-2.5 align-middle", key === "status" && "text-center")}>
                        {entity === "customers" && key === "fullName" ? (
                          <button
                            type="button"
                            className="flex cursor-pointer items-center gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-primary"
                            onClick={() => (onCustomer ? onCustomer(row) : setDetail(row))}
                          >
                            <GymAvatar name={row.fullName} />
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-on-surface hover:text-primary">
                                {row.fullName}
                              </span>
                              {row.initialGoal && (
                                <span className="block truncate text-xs text-on-surface-variant">
                                  {row.initialGoal}
                                </span>
                              )}
                            </span>
                          </button>
                        ) : (
                          display(row, key)
                        )}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-2.5 text-right align-middle">
                      <div className="flex items-center justify-end gap-1.5">
                        {extraActions?.(row, refresh)}
                        {entity === "goals" && canWrite && <button type="button" className={secondary} disabled={busy} onClick={async () => {
                          setBusy(true); setError("");
                          try { await api.request(`/goals/${row._id}/${row.status === "PUBLISHED" ? "unpublish" : "publish"}`, "PATCH", { revision: row.revision }); refresh(); }
                          catch (cause) { setError(messageOf(cause)); }
                          finally { setBusy(false); }
                        }}>{row.status === "PUBLISHED" ? "Thu hồi" : "Công bố"}</button>}
                        {entity === "knowledge" && admin && (
                          <button
                            type="button"
                            className={secondary}
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              setError("");
                              try {
                                await api.request(
                                  `/knowledge/${row._id}/${row.status === "PUBLISHED" ? "unpublish" : "publish"}`,
                                  "PATCH",
                                  { revision: row.revision },
                                );
                                refresh();
                              } catch (e) {
                                setError(messageOf(e));
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            {row.status === "PUBLISHED" ? "Thu hồi" : "Xuất bản"}
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label="Chi tiết"
                          title="Chi tiết"
                          className={iconActionClass}
                          onClick={() =>
                            entity === "customers" && onCustomer
                              ? onCustomer(row)
                              : setDetail(row)
                          }
                        >
                          <Eye className="size-4" aria-hidden="true" />
                        </button>
                        {canWrite && (
                          <>
                            <button
                              type="button"
                              aria-label="Sửa"
                              title="Sửa"
                              className={iconActionClass}
                              onClick={() => setEditor(row)}
                            >
                              <Pencil className="size-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              aria-label="Xóa"
                              title="Xóa"
                              className={dangerIconActionClass}
                              onClick={() => {
                                setError("");
                                setDeleting(row);
                              }}
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!result.data?.data.length && (
                  <tr>
                    <td className="p-4" colSpan={columns.length + 1}>
                      <GymEmptyState
                        kind={entityEmptyKind[entity] || "task"}
                        filtered={Boolean(search.trim() || status)}
                        title="Chưa có dữ liệu."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {result.data && (
          <TablePagination
            appearance="erp"
            currentPage={page}
            totalPages={result.data.meta.totalPages}
            pageSize={limit}
            totalItems={result.data.meta.total}
            pageSizeOptions={[10, 20, 50, 100]}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setLimit(size);
              setPage(1);
            }}
          />
        )}
      </div>

      {editor &&
        (entity === "customers" ? (
          <CustomerForm
            api={api}
            record={editor === "new" ? undefined : editor}
            onClose={() => setEditor(undefined)}
            onSaved={() => {
              setEditor(undefined);
              refresh();
            }}
          />
        ) : (
          <RecordEditor
            api={api}
            entity={entity}
            record={editor === "new" ? undefined : editor}
            customerId={customerId}
            onClose={() => setEditor(undefined)}
            onSaved={() => {
              setEditor(undefined);
              refresh();
            }}
          />
        ))}
      <ConfirmDialog
        native
        appearance="erp"
        isOpen={Boolean(deleting)}
        title="Xóa vĩnh viễn?"
        description="Dữ liệu đã xóa không thể khôi phục."
        confirmLabel="Xóa vĩnh viễn"
        isSubmitting={busy}
        error={error}
        onClose={() => {
          if (!busy) setDeleting(undefined);
        }}
        onConfirm={async () => {
          if (!deleting) return;
          setBusy(true);
          try {
            await api.remove(entity, deleting);
            setDeleting(undefined);
            refresh();
          } catch (e) {
            setError(messageOf(e));
          } finally {
            setBusy(false);
          }
        }}
      />
      {detail && (
        <ErpModal
          native
          title={detail.title || detail.name || labels[entity]}
          onClose={() => setDetail(undefined)}
          maxWidth="max-w-4xl"
        >
          {entity === "sessions" ? <SessionDetail session={detail} /> : <div className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              {entity === "goals" && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-on-surface-variant">Học viên / Khách hàng</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap break-words text-pretty text-sm text-on-surface">
                    {!detail.customerId
                      ? "—"
                      : detail.customerName
                        ? `${detail.customerName}${detail.customerPhone ? ` — ${detail.customerPhone}` : ""}`
                        : detailCustomer.loading
                          ? "Đang tải..."
                          : detailCustomer.data?.fullName
                            ? `${detailCustomer.data.fullName}${detailCustomer.data.phone ? ` — ${detailCustomer.data.phone}` : ""}`
                            : "—"}
                  </dd>
                </div>
              )}
              {(forms[entity] || []).map((f) => (
                <div key={f.key} className={f.multiline ? "sm:col-span-2" : ""}>
                  <dt className="text-xs font-medium text-on-surface-variant">{f.label}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap break-words text-pretty text-sm text-on-surface">
                    {display(detail, f.key)}
                  </dd>
                </div>
              ))}
            </dl>
            {detail.schedule?.map((day: any, i: number) => (
              <div key={i} className={panel}>
                <strong className="text-sm text-on-surface">
                  Ngày {day.day}: {day.title}
                </strong>
                <div className="mt-2 space-y-1 text-xs text-on-surface-variant">
                  {day.exercises.map((e: any, j: number) => (
                    <p key={j}>
                      {e.name} — {e.sets} × {e.reps}
                    </p>
                  ))}
                </div>
              </div>
            ))}
            {detail.menu?.map((meal: any, i: number) => (
              <div className={panel} key={i}>
                <strong>{meal.name}</strong>
                <p className="text-sm text-on-surface-variant">{meal.foods}</p>
                <p className="text-xs font-medium text-primary">{meal.calories} kcal</p>
                {meal.imageUrl && (
                  <img
                    src={meal.imageUrl}
                    alt={meal.name}
                    className="mt-2 size-32 rounded-md object-cover"
                  />
                )}
              </div>
            ))}
            {detail.phases?.map((phase: any, i: number) => (
              <div className={panel} key={i}>
                <strong>{phase.title}</strong>
                <p className="text-xs text-on-surface-variant">
                  {dateLabel(phase.startDate)} — {dateLabel(phase.endDate)}
                </p>
                <p className="mt-1 text-sm">{phase.goals}</p>
              </div>
            ))}
          </div>}
        </ErpModal>
      )}
    </section>
  );
}
