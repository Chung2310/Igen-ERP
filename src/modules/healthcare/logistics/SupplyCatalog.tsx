import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarX,
  Clock,
  Coins,
  History,
  Layers,
  Package,
  Pencil,
  RotateCcw,
} from "lucide-react";
import type { Supply, LogisticsList, LogisticsReferences, Balance } from "../../../../shared/healthcare-logistics";
import type { HealthcareApi } from "../api";
import { cn } from "../../student-management/lib/utils";
import {
  Cell,
  Table,
  Feedback,
  useHealthcareQuery,
  dayLabel,
  messageOf,
} from "../ui";
import { Dropdown } from "../../../components/common/Dropdown";
import { ErpRefreshButton } from "../../../components/common/ErpRefreshButton";
import { primaryCreateButtonClass } from "../../../components/common/primaryCreateButton";
import { TableFilterToolbar } from "../../../components/common/TableFilterToolbar";
import { TablePagination } from "../../../components/common/TablePagination";
import { ErpModal } from "../../../components/common/ErpModal";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import { HrStatusBadge } from "../../../components/hr/HrStatusBadge";
import SupplyEditor from "./SupplyEditor";
import SupplyDocumentEditor from "./SupplyDocumentEditor";
import { LogisticsFiles, AttachmentUpload } from "./LogisticsFiles";
import StockRows from "./SupplyBalances";

type Stats = {
  totalItems: number;
  totalQuantity: number;
  totalValue: number;
  lowStock: number;
  expired: number;
  expiringSoon: number;
};

const emptyRefs: LogisticsReferences = { warehouses: [], suppliers: [], rooms: [], departments: [], categories: [] };

const surfacePanelClass =
  "min-w-0 space-y-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 sm:p-4";

const secondaryActionClass =
  "inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

const rowActionClass =
  "inline-flex min-h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-1 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

const rowDangerActionClass =
  "inline-flex min-h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md border border-error/30 bg-surface-container-lowest px-2.5 py-1 text-xs font-medium text-error transition-colors hover:bg-error-container/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

const iconActionClass =
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors hover:border-primary/40 hover:bg-surface-container hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

const primaryIconActionClass =
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-primary/35 bg-primary/5 text-primary transition-colors hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

const dangerIconActionClass =
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-error/30 bg-surface-container-lowest text-error transition-colors hover:bg-error-container/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

const statItems = [
  {
    key: "totalItems",
    label: "Loại vật tư",
    icon: Package,
    iconTone: "logistics-kpi-icon--primary",
    filterKey: null,
    filterValue: "",
  },
  {
    key: "totalQuantity",
    label: "Tổng số lượng tồn",
    icon: Layers,
    iconTone: "logistics-kpi-icon--info",
    filterKey: null,
    filterValue: "",
  },
  {
    key: "totalValue",
    label: "Giá trị tồn (đồng)",
    icon: Coins,
    iconTone: "logistics-kpi-icon--success",
    filterKey: null,
    filterValue: "",
  },
  {
    key: "lowStock",
    label: "Sắp hết / hết hàng",
    icon: AlertTriangle,
    iconTone: "logistics-kpi-icon--warning",
    filterKey: "stockStatus",
    filterValue: "low-stock",
  },
  {
    key: "expired",
    label: "Đã hết hạn",
    icon: CalendarX,
    iconTone: "logistics-kpi-icon--danger",
    filterKey: "expiry",
    filterValue: "expired",
  },
  {
    key: "expiringSoon",
    label: "Cận hạn 30 ngày",
    icon: Clock,
    iconTone: "logistics-kpi-icon--warning",
    filterKey: "expiry",
    filterValue: "soon",
  },
] as const;

export default function SupplyCatalog({
  api,
  canManage,
  headerActionsContainer,
}: {
  api: HealthcareApi;
  canManage: boolean;
  headerActionsContainer?: HTMLElement | null;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [archived, setArchived] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [editor, setEditor] = useState<{ row?: Supply }>();
  const [batch, setBatch] = useState<{ type: "receipt" | "issue"; supply?: Supply }>();
  const [detail, setDetail] = useState<{ row: Supply; history?: boolean }>();
  const [archive, setArchive] = useState<Supply>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const focus = useRef<HTMLElement | null>(null);
  const refs = useHealthcareQuery<LogisticsReferences>(api, "/logistics/supplies-references");
  const params = new URLSearchParams({
    q,
    page: String(page),
    active: String(!archived),
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
  });
  const list = useHealthcareQuery<LogisticsList<Supply>>(api, `/logistics/supplies?${params}`);
  const stats = useHealthcareQuery<Stats>(api, "/logistics/overview/supplies");
  const references = refs.data || emptyRefs;
  const remember = () => {
    focus.current = document.activeElement as HTMLElement;
  };
  function close() {
    setEditor(undefined);
    setBatch(undefined);
    setDetail(undefined);
    requestAnimationFrame(() => focus.current?.focus());
  }
  function refresh() {
    list.refresh();
    stats.refresh();
    refs.refresh();
  }
  function saved() {
    close();
    refresh();
  }
  const hasActiveFilters = Boolean(q.trim() || Object.values(filters).some(Boolean));
  const resetFilters = () => {
    setQ("");
    setFilters({});
    setPage(1);
  };
  const choice = (items: { _id: string; name: string }[], allLabel: string) => [
    { value: "", label: allLabel },
    ...items.map((x) => ({ value: x._id, label: x.name })),
  ];
  async function toggleActive() {
    if (!archive) return;
    setBusy(true);
    setError("");
    try {
      await api.json(`/logistics/supplies/${archive._id}/active`, {
        method: "POST",
        body: JSON.stringify({ revision: archive.revision, active: !archive.active }),
      });
      setArchive(undefined);
      refresh();
      requestAnimationFrame(() => focus.current?.focus());
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  const headerActionButtons = (
    <>
      <ErpRefreshButton loading={list.refreshing} onClick={refresh} />
      {canManage && !archived && (
        <>
          <button
            type="button"
            className={secondaryActionClass}
            disabled={!refs.data}
            onClick={() => {
              remember();
              setBatch({ type: "issue" });
            }}
          >
            − Xuất kho theo lô
          </button>
          <button
            type="button"
            className={secondaryActionClass}
            disabled={!refs.data}
            onClick={() => {
              remember();
              setEditor({});
            }}
          >
            + Khai báo danh mục mới
          </button>
          <button
            type="button"
            className={cn(primaryCreateButtonClass, "min-h-9")}
            disabled={!refs.data}
            onClick={() => {
              remember();
              setBatch({ type: "receipt" });
            }}
          >
            + Nhập kho theo lô
          </button>
        </>
      )}
    </>
  );

  return (
    <div className="space-y-3">
      {headerActionsContainer && createPortal(headerActionButtons, headerActionsContainer)}
      {stats.loading && !stats.data && (
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
          aria-busy="true"
          aria-label="Đang tải thống kê vật tư"
        >
          {statItems.map(({ key }) => (
            <div
              key={key}
              className="h-[74px] rounded-lg border border-outline-variant bg-surface-container-lowest p-3.5"
            >
              <div className="h-3 w-20 rounded bg-surface-container" />
              <div className="mt-2.5 h-6 w-14 rounded bg-surface-container" />
            </div>
          ))}
        </div>
      )}
      {stats.data && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {statItems.map(({ key, label, icon: Icon, iconTone, filterKey, filterValue }) => {
            const value = stats.data![key];
            const active = filterKey ? filters[filterKey] === filterValue : false;
            const isDanger = key === "expired" && value > 0;
            const cardContent = (
              <>
                <div className="min-w-0 space-y-1">
                  <dt className="truncate text-xs text-on-surface-variant" title={label}>
                    {label}
                  </dt>
                  <dd
                    className={cn(
                      "truncate text-xl font-semibold leading-tight tabular-nums",
                      isDanger ? "text-error" : "text-on-surface",
                    )}
                    title={value.toLocaleString("vi-VN")}
                  >
                    {value.toLocaleString("vi-VN")}
                  </dd>
                </div>
                <span
                  className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-lg", iconTone)}
                  aria-hidden="true"
                >
                  <Icon className="size-4" />
                </span>
              </>
            );
            return (
              <div key={key}>
                {filterKey ? (
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setFilters((v) => ({ ...v, [filterKey]: active ? "" : filterValue }));
                      setPage(1);
                    }}
                    className={cn(
                      "flex h-full w-full cursor-pointer items-center justify-between gap-2.5 rounded-lg border bg-surface-container-lowest px-3.5 py-3 text-left shadow-2xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                      active
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-outline-variant hover:border-primary/40 hover:bg-surface-container-low/50",
                    )}
                  >
                    {cardContent}
                  </button>
                ) : (
                  <div className="flex h-full items-center justify-between gap-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3.5 py-3 shadow-2xs">
                    {cardContent}
                  </div>
                )}
              </div>
            );
          })}
        </dl>
      )}
      <Feedback error={stats.error} onRetry={stats.refresh} />

      <div className={surfacePanelClass}>
        <TableFilterToolbar
          appearance="plain"
          search={{
            value: q,
            onChange: (value) => {
              setQ(value);
              setPage(1);
            },
            placeholder: "Tìm mã hoặc tên vật tư",
            ariaLabel: "Tìm vật tư",
            className: "min-w-0",
          }}
          totalCount={list.data ? list.data.total : undefined}
          countLabel="vật tư"
          hasActiveFilters={hasActiveFilters}
          onResetFilters={resetFilters}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <LogisticsFiles api={api} kind="supplies" canManage={canManage && !archived} onSaved={refresh} />
              {!headerActionsContainer && headerActionButtons}
            </div>
          }
          secondaryFilters={
            <>
              <Dropdown
                aria-label="Phân loại"
                variant="filter"
                value={filters.category || ""}
                onChange={(value) => {
                  setFilters((v) => ({ ...v, category: value }));
                  setPage(1);
                }}
                options={[
                  { value: "", label: "Tất cả phân loại" },
                  ...(references.categories || []).map((x) => ({ value: x.name, label: x.name })),
                ]}
              />
              <Dropdown
                aria-label="Nhà cung cấp"
                variant="filter"
                value={filters.supplierId || ""}
                onChange={(value) => {
                  setFilters((v) => ({ ...v, supplierId: value }));
                  setPage(1);
                }}
                options={choice(references.suppliers, "Tất cả nhà cung cấp")}
              />
              <Dropdown
                aria-label="Kho lưu trữ"
                variant="filter"
                value={filters.warehouseId || ""}
                onChange={(value) => {
                  setFilters((v) => ({ ...v, warehouseId: value }));
                  setPage(1);
                }}
                options={choice(references.warehouses, "Tất cả kho lưu trữ")}
              />
              <Dropdown
                aria-label="Trạng thái tồn"
                variant="filter"
                value={filters.stockStatus || ""}
                onChange={(value) => {
                  setFilters((v) => ({ ...v, stockStatus: value }));
                  setPage(1);
                }}
                options={[
                  { value: "", label: "Tất cả trạng thái tồn" },
                  { value: "in-stock", label: "Còn hàng" },
                  { value: "low-stock", label: "Sắp hết hàng" },
                  { value: "out-of-stock", label: "Hết hàng" },
                ]}
              />
              <Dropdown
                aria-label="Hạn sử dụng"
                variant="filter"
                value={filters.expiry || ""}
                onChange={(value) => {
                  setFilters((v) => ({ ...v, expiry: value }));
                  setPage(1);
                }}
                options={[
                  { value: "", label: "Tất cả hạn sử dụng" },
                  { value: "expired", label: "Đã hết hạn" },
                  { value: "soon", label: "Cận hạn 30 ngày" },
                ]}
              />
              <label className="ml-auto inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low">
                <input
                  type="checkbox"
                  checked={archived}
                  className="size-3.5 accent-primary"
                  onChange={(e) => {
                    setArchived(e.target.checked);
                    setPage(1);
                  }}
                />
                Đã ngừng sử dụng
              </label>
            </>
          }
        />

        <Feedback loading={list.loading} error={list.error} onRetry={list.refresh} />
        <Feedback error={refs.error} onRetry={refs.refresh} />

        {list.data && (
          <>
            <div className="space-y-3 md:hidden">
              {!list.data.items.length && <p className="rounded-lg border border-outline-variant p-4 text-sm text-on-surface-variant">{archived ? "Không có vật tư đã ngừng sử dụng." : "Chưa có vật tư phù hợp. Chọn Khai báo danh mục mới để bắt đầu."}</p>}
              {list.data.items.map((row) => <article key={row._id} className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><h3 className="truncate text-balance text-sm font-semibold text-on-surface">{row.name}</h3><p className="text-xs text-on-surface-variant">{row.code} · {row.category || "Chưa phân loại"}</p></div>
                  <HrStatusBadge dot tone={row.expired || row.stockStatus === "out-of-stock" ? "danger" : row.expiringSoon || row.stockStatus === "low-stock" ? "warning" : "success"}>{row.expired ? "Hết hạn" : row.expiringSoon ? "Cận hạn" : row.stockStatus === "out-of-stock" ? "Hết hàng" : row.stockStatus === "low-stock" ? "Sắp hết hàng" : "Còn hàng"}</HrStatusBadge>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs"><div><dt className="text-on-surface-variant">Tồn kho</dt><dd className="font-semibold tabular-nums text-on-surface">{(row.quantity || 0).toLocaleString("vi-VN")} {row.unit}</dd></div><div><dt className="text-on-surface-variant">Giá trị tồn</dt><dd className="font-semibold tabular-nums text-on-surface">{(row.stockValue || 0).toLocaleString("vi-VN")} đ</dd></div></dl>
                <div className="flex flex-wrap gap-2 border-t border-outline-variant pt-3">
                  <button type="button" className={rowActionClass} onClick={() => { remember(); setDetail({ row }); }}>Chi tiết</button>
                  <button type="button" className={rowActionClass} onClick={() => { remember(); setDetail({ row, history: true }); }}>Lịch sử</button>
                  {canManage && <button type="button" className={rowActionClass} onClick={() => { remember(); setEditor({ row }); }}>Sửa</button>}
                  {canManage && row.active && <><button type="button" className={rowActionClass} onClick={() => { remember(); setBatch({ type: "receipt", supply: row }); }}>Nhập</button><button type="button" className={rowActionClass} onClick={() => { remember(); setBatch({ type: "issue", supply: row }); }}>Xuất</button></>}
                  {canManage && <button type="button" className={row.active ? rowDangerActionClass : rowActionClass} onClick={() => { remember(); setError(""); setArchive(row); }}>{row.active ? "Ngừng sử dụng" : "Khôi phục"}</button>}
                </div>
              </article>)}
            </div>
            <div className="hidden md:block">
            <Table
              minWidth="860px"
              columnWidths={["28%", "16%", "13%", "13%", "13%", "17%"]}
              headers={["Vật tư", "Phân loại", "Tồn / Đơn vị", "Giá trị tồn", "Cảnh báo", "Thao tác"]}
              empty={
                !list.data.items.length
                  ? archived
                    ? "Không có vật tư đã ngừng sử dụng."
                    : "Chưa có vật tư phù hợp. Chọn Khai báo danh mục mới để bắt đầu."
                  : undefined
              }
            >
              {list.data.items.map((row) => {
                const alertMeta = row.expired
                  ? { label: "Hết hạn", tone: "danger" as const }
                  : row.expiringSoon
                    ? { label: "Cận hạn", tone: "warning" as const }
                    : row.stockStatus === "out-of-stock"
                      ? { label: "Hết hàng", tone: "danger" as const }
                      : row.stockStatus === "low-stock"
                        ? { label: "Sắp hết hàng", tone: "warning" as const }
                        : { label: "Còn hàng", tone: "success" as const };
                return (
                  <tr key={row._id}>
                    <Cell className="min-w-0 align-middle">
                      <div className="min-w-0">
                        <button
                          type="button"
                          className="block max-w-full cursor-pointer truncate rounded-sm text-left text-sm font-medium text-on-surface transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          title={row.name}
                          onClick={() => {
                            remember();
                            setDetail({ row });
                          }}
                        >
                          {row.name}
                        </button>
                        <span className="mt-1 inline-block rounded bg-surface-container px-1.5 py-0.5 text-[11px] font-medium text-on-surface-variant">
                          {row.code}
                        </span>
                      </div>
                    </Cell>
                    <Cell className="align-middle">{row.category || "—"}</Cell>
                    <Cell align="right" className="whitespace-nowrap align-middle tabular-nums">
                      <span className="font-semibold text-on-surface">
                        {(row.quantity || 0).toLocaleString("vi-VN")}
                      </span>{" "}
                      <span className="text-xs text-on-surface-variant">{row.unit}</span>
                    </Cell>
                    <Cell align="right" className="whitespace-nowrap align-middle font-medium tabular-nums">
                      {(row.stockValue || 0).toLocaleString("vi-VN")} đ
                    </Cell>
                    <Cell className="whitespace-nowrap align-middle">
                      <HrStatusBadge dot tone={alertMeta.tone}>
                        {alertMeta.label}
                      </HrStatusBadge>
                    </Cell>
                    <Cell align="right" className="whitespace-nowrap align-middle">
                      <div className="flex items-center justify-end gap-1">
                        {canManage && row.active && (
                          <>
                            <button
                              type="button"
                              aria-label="Nhập"
                              title="Nhập kho"
                              className={primaryIconActionClass}
                              onClick={() => {
                                remember();
                                setBatch({ type: "receipt", supply: row });
                              }}
                            >
                              <ArrowDownToLine className="size-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              aria-label="Xuất"
                              title="Xuất kho"
                              className={iconActionClass}
                              onClick={() => {
                                remember();
                                setBatch({ type: "issue", supply: row });
                              }}
                            >
                              <ArrowUpFromLine className="size-4" aria-hidden="true" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          aria-label="Lịch sử"
                          title="Lịch sử xuất nhập"
                          className={iconActionClass}
                          onClick={() => {
                            remember();
                            setDetail({ row, history: true });
                          }}
                        >
                          <History className="size-4" aria-hidden="true" />
                        </button>
                        {canManage && (
                          <>
                            <button
                              type="button"
                              aria-label="Sửa"
                              title="Sửa vật tư"
                              className={iconActionClass}
                              onClick={() => {
                                remember();
                                setEditor({ row });
                              }}
                            >
                              <Pencil className="size-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              aria-label={row.active ? "Ngừng sử dụng" : "Khôi phục"}
                              title={row.active ? "Ngừng sử dụng" : "Khôi phục vật tư"}
                              className={row.active ? dangerIconActionClass : iconActionClass}
                              onClick={() => {
                                remember();
                                setError("");
                                setArchive(row);
                              }}
                            >
                              {row.active ? (
                                <Archive className="size-4" aria-hidden="true" />
                              ) : (
                                <RotateCcw className="size-4" aria-hidden="true" />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </Cell>
                  </tr>
                );
              })}
            </Table>
            </div>
            <TablePagination
              appearance="erp"
              currentPage={page}
              totalPages={Math.max(1, Math.ceil(list.data.total / 25))}
              totalItems={list.data.total}
              pageSize={25}
              pageSizeOptions={[25]}
              onPageChange={setPage}
              onPageSizeChange={() => {}}
            />
          </>
        )}
      </div>

      {editor && <SupplyEditor api={api} record={editor.row} refs={references} onClose={close} onSaved={saved} />}
      {batch && (
        <SupplyDocumentEditor
          api={api}
          refs={references}
          batchType={batch.type}
          initialSupply={batch.supply}
          onClose={close}
          onSaved={saved}
        />
      )}
      {detail && (
        <SupplyDetails
          api={api}
          row={detail.row}
          showHistory={detail.history}
          refs={references}
          canManage={canManage}
          onClose={close}
          onSaved={saved}
        />
      )}
      {archive && (
        <ConfirmDialog
          native
          appearance="erp"
          isOpen
          title={archive.active ? "Ngừng sử dụng vật tư" : "Khôi phục vật tư"}
          description={`${archive.name}. Dữ liệu lịch sử vẫn được giữ nguyên.`}
          onClose={() => {
            if (!busy) {
              setArchive(undefined);
              requestAnimationFrame(() => focus.current?.focus());
            }
          }}
          onConfirm={toggleActive}
          isSubmitting={busy}
          error={error}
        />
      )}
    </div>
  );
}

function SupplyDetails({
  api,
  row,
  refs,
  showHistory,
  canManage,
  onClose,
  onSaved,
}: {
  api: HealthcareApi;
  row: Supply;
  refs: LogisticsReferences;
  showHistory?: boolean;
  canManage: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [page, setPage] = useState(1);
  const history = useHealthcareQuery<LogisticsList<Balance>>(
    api,
    showHistory ? `/logistics/ledger?supplyId=${row._id}&page=${page}` : null,
  );
  return (
    <ErpModal
      native
      title={`${showHistory ? "Lịch sử" : "Chi tiết"} · ${row.name}`}
      onClose={onClose}
      maxWidth="max-w-3xl"
    >
      {showHistory ? (
        <div className="space-y-3">
          <Feedback loading={history.loading} error={history.error} onRetry={history.refresh} />
          {history.data && (
            <>
              <StockRows
                rows={history.data.items}
                api={api}
                warehouseName={(id) => refs.warehouses.find((x) => x._id === id)?.name || "Kho lưu trữ"}
                ledger
              />
              <TablePagination
                appearance="erp"
                currentPage={page}
                totalPages={Math.max(1, Math.ceil(history.data.total / 25))}
                totalItems={history.data.total}
                pageSize={25}
                pageSizeOptions={[25]}
                onPageChange={setPage}
                onPageSizeChange={() => {}}
              />
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {row.imageUrl && (
            <img
              src={row.imageUrl}
              alt={row.name}
              className="max-h-60 rounded-lg border border-outline-variant object-contain"
            />
          )}
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["Mã", row.code],
              ["Phân loại", row.category],
              ["Đơn vị", row.unit],
              ["Tồn tối thiểu", String(row.minQuantity)],
              ["Vị trí", row.warehouseLocation],
              ["Ngày sản xuất", dayLabel(row.manufactureDay || "")],
              ["Kiểm định", dayLabel(row.inspectionDay || "")],
              ["Kiểm định tiếp theo", dayLabel(row.nextInspectionDay || "")],
              ["Số chứng nhận", row.inspectionCertificateNumber],
              ["Ghi chú", row.notes],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-medium text-on-surface-variant">{label}</dt>
                <dd className="mt-0.5 text-on-surface">{value || "—"}</dd>
              </div>
            ))}
          </dl>
          {row.documents.length > 0 && (
            <div className="space-y-1 border-t border-outline-variant pt-3">
              <p className="text-xs font-medium text-on-surface-variant">Tài liệu đính kèm</p>
              {row.documents.map((d, i) => (
                <a
                  key={i}
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-primary underline underline-offset-2"
                >
                  {d.name}
                </a>
              ))}
            </div>
          )}
          {canManage && <AttachmentUpload api={api} kind="supplies" id={row._id} onSaved={onSaved} />}
          {canManage && <AttachmentUpload image api={api} kind="supplies" id={row._id} onSaved={onSaved} />}
        </div>
      )}
    </ErpModal>
  );
}
