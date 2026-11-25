import { useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";
import EquipmentTable from "./EquipmentTable";
import EquipmentRequestPicker from "./EquipmentRequestPicker";
import "./logistics.css";
import EquipmentOverview from "./EquipmentOverview";
import StockRows from "./SupplyBalances";
import { cn } from "../../student-management/lib/utils";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import { Dropdown } from "../../../components/common/Dropdown";
import { ErpModal } from "../../../components/common/ErpModal";
import { ErpRefreshButton } from "../../../components/common/ErpRefreshButton";
import { primaryCreateButtonClass } from "../../../components/common/primaryCreateButton";
import { TableFilterToolbar } from "../../../components/common/TableFilterToolbar";
import { TablePagination } from "../../../components/common/TablePagination";
import { HrStatusBadge } from "../../../components/hr/HrStatusBadge";
import { healthcareApi } from "../api";
import {
  Cell,
  Field,
  Feedback,
  Table,
  dayLabel,
  messageOf,
  useHealthcareQuery,
} from "../ui";
import {
  documentLabels,
  documentTypes,
  equipmentLabels,
  requestLabels,
  type Equipment,
  type EquipmentRequest,
  type StockDocument,
  type Balance,
  type Ledger,
  type LogisticsReferences,
  type LogisticsList,
  type LogisticsKind,
} from "../../../../shared/healthcare-logistics";
import EquipmentEditor from "./EquipmentEditor";
import EquipmentCompliance from "./EquipmentCompliance";
import SupplyDocumentEditor from "./SupplyDocumentEditor";
import { LogisticsFiles } from "./LogisticsFiles";
import { LogisticsForm } from "./LogisticsForm";

type Row = Equipment | EquipmentRequest | StockDocument | Balance | Ledger;
type Editor =
  | { kind: "equipment"; row?: Equipment }
  | { kind: "documents"; row?: StockDocument; batchType?: "receipt" | "issue" }
  | { kind: "compliance"; row: Equipment }
  | { kind: "borrow" | "return"; row?: Equipment };

const emptyRefs: LogisticsReferences = { warehouses: [], suppliers: [], departments: [], rooms: [] };

const surfacePanelClass = "flex min-w-0 flex-1 flex-col gap-3";

const secondaryActionClass =
  "inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

const rowActionClass =
  "inline-flex min-h-8 shrink-0 items-center justify-center gap-1 rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-1 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

const rowPrimaryActionClass =
  "inline-flex min-h-8 shrink-0 items-center justify-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

const rowDangerActionClass =
  "inline-flex min-h-8 shrink-0 items-center justify-center gap-1 rounded-md border border-error/30 bg-surface-container-lowest px-2.5 py-1 text-xs font-medium text-error transition-colors hover:bg-error-container/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

const requestStatusTone = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
} as const;

const documentStatusTone = {
  draft: "neutral",
  submitted: "info",
  approved: "warning",
  posted: "success",
  rejected: "danger",
  cancelled: "neutral",
} as const;

export default function LogisticsPage({
  kind,
  branchId,
  hasPermission,
  initialView,
  embedded = false,
}: {
  initialView?: string;
  embedded?: boolean;
  kind: LogisticsKind;
  branchId: string;
  hasPermission: (permission: string) => boolean;
}) {
  const api = useMemo(() => healthcareApi(branchId), [branchId]);
  const [view, setView] = useState<string>(initialView || (kind === "supplies" ? "documents" : kind));
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<Editor>();
  const [preview, setPreview] = useState<StockDocument>();
  const [action, setAction] = useState<{
    row: EquipmentRequest | StockDocument;
    action: string;
    key: string;
    title: string;
  }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const focus = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLDivElement>(null);
  const refs = useHealthcareQuery<LogisticsReferences>(api, `/logistics/${kind}-references`);
  const query = useHealthcareQuery<LogisticsList<Row>>(
    api,
    `/logistics/${view}?page=${page}&q=${encodeURIComponent(search)}&${new URLSearchParams(view === "equipment" ? Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) : {})}`,
  );
  const canManage = hasPermission("healthcare:manage");
  const canApprove = canManage;
  const canPost = canManage;
  const tabs =
    kind === "equipment"
      ? [
          ["equipment", "Thiết bị"],
          ["requests", "Mượn / trả"],
        ]
      : [
          ["supplies", "Danh mục vật tư"],
          ["documents", "Phiếu kho"],
          ["balances", "Tồn kho"],
          ["ledger", "Sổ kho"],
        ];
  const visibleTabs = tabs.filter(
    ([key]) =>
      !embedded || (initialView === "balances" ? ["balances", "ledger"].includes(key) : key === "documents"),
  );
  const remember = () => {
    focus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  };
  function restore() {
    requestAnimationFrame(() => (focus.current?.isConnected ? focus.current : heading.current)?.focus());
  }
  function close() {
    setEditor(undefined);
    setPreview(undefined);
    restore();
  }
  function saved() {
    close();
    query.refresh();
    setRefreshVersion((v) => v + 1);
  }
  function open(value: Editor) {
    remember();
    setEditor(value);
  }
  function confirm(row: EquipmentRequest | StockDocument, action: string, title: string) {
    remember();
    setError("");
    setAction({ row, action, title, key: crypto.randomUUID() });
  }
  async function execute() {
    if (!action || busy) return;
    setBusy(true);
    setError("");
    try {
      await api.json(`/logistics/${view}/${action.row._id}/action`, {
        method: "POST",
        headers: { "Idempotency-Key": action.key },
        body: JSON.stringify({ revision: action.row.revision, action: action.action }),
      });
      setAction(undefined);
      query.refresh();
      restore();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }
  const rows = query.data?.items || [];
  const references = refs.data || emptyRefs;
  const warehouseName = (id: string) =>
    references.warehouses.find((x) => x._id === id)?.name || "Kho không còn hoạt động";

  const hasActiveFilters = Boolean(
    search.trim() || (view === "equipment" && Object.values(filters).some(Boolean)),
  );
  const resetFilters = () => {
    setSearch("");
    setFilters({});
    setPage(1);
  };

  const searchPlaceholder =
    view === "equipment"
      ? "Tìm mã, tên, model hoặc số seri thiết bị"
      : view === "requests"
        ? "Tìm thiết bị, người yêu cầu hoặc lý do"
        : view === "documents"
          ? "Tìm mã phiếu, lý do hoặc kho"
          : "Tìm vật tư, số lô hoặc kho lưu trữ";

  const countLabel =
    view === "equipment"
      ? "thiết bị"
      : view === "requests"
        ? "yêu cầu"
        : view === "documents"
          ? "phiếu"
          : "bản ghi";

  const showTabs = !embedded || visibleTabs.length > 1;
  const headerActions = (
    <div ref={heading} tabIndex={-1} className="flex shrink-0 flex-wrap items-center gap-2 outline-none">
      {kind === "equipment" && (
        <button
          type="button"
          className="inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-surface-container-lowest px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={() => open({ kind: "borrow" })}
        >
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
          Tạo phiếu mượn/trả
        </button>
      )}
      <ErpRefreshButton loading={query.refreshing} onClick={query.refresh} />
      {canManage && view === "documents" && (
        <>
          <button type="button" className={secondaryActionClass} disabled={!refs.data} onClick={() => open({ kind: "documents", batchType: "issue" })}>
            − Xuất kho theo lô
          </button>
          <button type="button" className={cn(primaryCreateButtonClass, "min-h-9")} disabled={!refs.data} onClick={() => open({ kind: "documents", batchType: "receipt" })}>
            + Nhập kho theo lô
          </button>
        </>
      )}
      {canManage && view === "equipment" && (
        <button
          type="button"
          className={cn(primaryCreateButtonClass, "min-h-9")}
          disabled={!refs.data}
          onClick={() => open({ kind: view as "equipment" | "documents" })}
        >
          <Plus className="size-3.5 stroke-[2.5]" aria-hidden="true" />
          Thêm thiết bị
        </button>
      )}
    </div>
  );

  const content = (
    <>
      {showTabs && (
        <nav
          aria-label="Nghiệp vụ hậu cần y tế"
          className="flex min-w-0 shrink-0 gap-1 overflow-x-auto border-b border-outline-variant"
        >
          {visibleTabs.map(([key, label]) => {
            const active = key === view;
            return (
              <button
                key={key}
                type="button"
                className={cn(
                  "shrink-0 cursor-pointer border-b-2 px-3.5 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
                  active
                    ? "border-primary font-semibold text-primary"
                    : "border-transparent font-medium text-on-surface-variant hover:border-outline-variant hover:text-on-surface",
                )}
                aria-pressed={active}
                onClick={() => {
                  setView(key);
                  setPage(1);
                  setSearch("");
                }}
              >
                {label}
              </button>
            );
          })}
        </nav>
      )}

      {view === "equipment" && (
        <EquipmentOverview
          key={refreshVersion}
          api={api}
          filters={filters}
          onToggleFilter={(key, value) => {
            setFilters((v) => ({ ...v, [key]: value }));
            setPage(1);
          }}
          onResetFilters={resetFilters}
        />
      )}

      <div className={surfacePanelClass}>
        <TableFilterToolbar
          appearance="plain"
          search={{
            value: search,
            onChange: (value) => {
              setSearch(value);
              setPage(1);
            },
            placeholder: searchPlaceholder,
            ariaLabel: searchPlaceholder,
            className: "min-w-0",
          }}
          totalCount={query.data ? query.data.total : undefined}
          countLabel={countLabel}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={resetFilters}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {view === "documents" ? (
                <LogisticsFiles api={api} kind="documents" canManage={false} onSaved={query.refresh} />
              ) : view === kind ? (
                <LogisticsFiles api={api} kind={kind} canManage={canManage} onSaved={query.refresh} />
              ) : null}
              {headerActions}
            </div>
          }
          secondaryFilters={
            view === "equipment" ? (
              <>
                <input
                  type="text"
                  aria-label="Phân loại thiết bị"
                  placeholder="Phân loại thiết bị..."
                  value={filters.category || ""}
                  onChange={(e) => {
                    setFilters((v) => ({ ...v, category: e.target.value }));
                    setPage(1);
                  }}
                  className="h-9 w-44 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-xs text-on-surface placeholder:text-on-surface-variant/60 outline-none transition focus:border-primary"
                />
                <Dropdown
                  aria-label="Trạng thái"
                  variant="filter"
                  value={filters.status || ""}
                  onChange={(value) => {
                    setFilters((v) => ({ ...v, status: value }));
                    setPage(1);
                  }}
                  options={[
                    { value: "", label: "Tất cả trạng thái" },
                    ...Object.entries(equipmentLabels).map(([value, label]) => ({ value, label })),
                  ]}
                />
                <Dropdown
                  aria-label="Phòng ban"
                  variant="filter"
                  value={filters.departmentId || ""}
                  onChange={(value) => {
                    setFilters((v) => ({ ...v, departmentId: value }));
                    setPage(1);
                  }}
                  options={[
                    { value: "", label: "Tất cả phòng ban" },
                    ...references.departments.map((x) => ({ value: x._id, label: x.name })),
                  ]}
                />
                <Dropdown
                  aria-label="Phòng y tế"
                  variant="filter"
                  value={filters.roomId || ""}
                  onChange={(value) => {
                    setFilters((v) => ({ ...v, roomId: value }));
                    setPage(1);
                  }}
                  options={[
                    { value: "", label: "Tất cả phòng y tế" },
                    ...references.rooms.map((x) => ({ value: x._id, label: x.name })),
                  ]}
                />
                <Dropdown
                  aria-label="Phân loại rủi ro"
                  variant="filter"
                  value={filters.riskClassification || ""}
                  onChange={(value) => {
                    setFilters((v) => ({ ...v, riskClassification: value }));
                    setPage(1);
                  }}
                  options={[
                    { value: "", label: "Tất cả mức rủi ro" },
                    ...["A", "B", "C", "D"].map((value) => ({ value, label: `Nhóm ${value}` })),
                  ]}
                />
                <Dropdown
                  aria-label="Hạn kiểm định"
                  variant="filter"
                  value={filters.inspectionStatus || ""}
                  onChange={(value) => {
                    setFilters((v) => ({ ...v, inspectionStatus: value }));
                    setPage(1);
                  }}
                  options={[
                    { value: "", label: "Tất cả hạn kiểm định" },
                    { value: "overdue", label: "Quá hạn" },
                    { value: "soon", label: "Đến hạn trong 30 ngày" },
                    { value: "valid", label: "Còn hạn trên 30 ngày" },
                    { value: "none", label: "Chưa có lịch" },
                  ]}
                />
              </>
            ) : undefined
          }
        />

        <Feedback loading={query.loading} error={query.error} onRetry={query.refresh} />
        <Feedback error={refs.error} onRetry={refs.refresh} />

        {query.data && (
          <>
            {view === "equipment" && (
              <EquipmentTable
                rows={rows as Equipment[]}
                refs={references}
                canManage={canManage}
                onOpen={(kind, row) => open({ kind, row })}
              />
            )}
            {view === "requests" && (
              <Table
                headers={["Thiết bị", "Người yêu cầu", "Yêu cầu", "Lý do", "Hạn trả", "Trạng thái", "Thao tác"]}
                empty={!rows.length ? "Chưa có yêu cầu mượn/trả." : undefined}
              >
                {(rows as EquipmentRequest[]).map((row) => (
                  <tr key={row._id}>
                    <Cell className="font-medium text-on-surface">{row.equipmentName}</Cell>
                    <Cell>{row.employeeName || "—"}</Cell>
                    <Cell className="whitespace-nowrap">
                      <HrStatusBadge tone={row.type === "borrow" ? "info" : "violet"} className="normal-case">
                        {row.type === "borrow" ? "Mượn" : "Trả"}
                      </HrStatusBadge>
                    </Cell>
                    <Cell>
                      <span className="block">{row.reason}</span>
                      {row.decisionReason && (
                        <p className="mt-1 text-xs text-error">Lý do từ chối: {row.decisionReason}</p>
                      )}
                    </Cell>
                    <Cell className="whitespace-nowrap">{dayLabel(row.expectedReturnDay)}</Cell>
                    <Cell className="whitespace-nowrap">
                      <HrStatusBadge
                        dot
                        tone={requestStatusTone[row.status as keyof typeof requestStatusTone] || "neutral"}
                      >
                        {requestLabels[row.status]}
                      </HrStatusBadge>
                    </Cell>
                    <Cell align="right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {row.status === "pending" && (
                          <>
                            {canManage && (
                              <>
                                <button
                                  type="button"
                                  className={rowPrimaryActionClass}
                                  onClick={() => confirm(row, "approve", "Duyệt yêu cầu")}
                                >
                                  Duyệt
                                </button>
                                <button
                                  type="button"
                                  className={rowDangerActionClass}
                                  onClick={() => confirm(row, "reject", "Từ chối yêu cầu")}
                                >
                                  Từ chối
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              className={rowActionClass}
                              onClick={() => confirm(row, "cancel", "Hủy yêu cầu của tôi")}
                            >
                              Hủy yêu cầu của tôi
                            </button>
                          </>
                        )}
                      </div>
                    </Cell>
                  </tr>
                ))}
              </Table>
            )}
            {view === "documents" && (
              <Table
                headers={["Phiếu", "Kho", "Lý do", "Trạng thái", "Thao tác"]}
                empty={!rows.length ? "Chưa có phiếu kho. Chọn Nhập kho theo lô hoặc Xuất kho theo lô để bắt đầu." : undefined}
              >
                {(rows as StockDocument[]).map((row) => (
                  <tr key={row._id}>
                    <Cell className="whitespace-nowrap">
                      <span className="block font-medium text-on-surface">{documentTypes[row.type]}</span>
                      {row.voucherCode && <span className="mt-0.5 block font-mono text-xs text-on-surface">{row.voucherCode}</span>}
                      <span className="mt-0.5 block text-xs text-on-surface-variant">
                        {dayLabel(row.voucherDay || row.createdAt.slice(0, 10))}
                      </span>
                    </Cell>
                    <Cell>{warehouseName(row.warehouseId)}</Cell>
                    <Cell>{row.reason}</Cell>
                    <Cell className="whitespace-nowrap">
                      <HrStatusBadge
                        dot
                        tone={documentStatusTone[row.status as keyof typeof documentStatusTone] || "neutral"}
                      >
                        {documentLabels[row.status]}
                      </HrStatusBadge>
                    </Cell>
                    <Cell align="right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          className={rowActionClass}
                          onClick={() => {
                            remember();
                            setPreview(row);
                          }}
                        >
                          Chi tiết
                        </button>
                        {canManage && ["draft", "rejected"].includes(row.status) && (
                          <>
                            <button
                              type="button"
                              className={rowActionClass}
                              onClick={() => open({ kind: "documents", row })}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              className={rowPrimaryActionClass}
                              onClick={() => confirm(row, "submit", "Gửi duyệt phiếu")}
                            >
                              Gửi duyệt
                            </button>
                          </>
                        )}
                        {canApprove && row.status === "submitted" && (
                          <>
                            <button
                              type="button"
                              className={rowPrimaryActionClass}
                              onClick={() => confirm(row, "approve", "Duyệt phiếu")}
                            >
                              Duyệt
                            </button>
                            <button
                              type="button"
                              className={rowDangerActionClass}
                              onClick={() => confirm(row, "reject", "Từ chối phiếu")}
                            >
                              Từ chối
                            </button>
                          </>
                        )}
                        {canPost && row.status === "approved" && (
                          <button
                            type="button"
                            className={rowPrimaryActionClass}
                            onClick={() => confirm(row, "post", "Ghi sổ kho")}
                          >
                            Ghi sổ
                          </button>
                        )}
                        {canManage && !["posted", "cancelled"].includes(row.status) && (
                          <button
                            type="button"
                            className={rowDangerActionClass}
                            onClick={() => confirm(row, "cancel", "Hủy phiếu")}
                          >
                            Hủy
                          </button>
                        )}
                      </div>
                    </Cell>
                  </tr>
                ))}
              </Table>
            )}
            {["balances", "ledger"].includes(view) && (
              <StockRows rows={rows as Balance[]} api={api} warehouseName={warehouseName} ledger={view === "ledger"} />
            )}
            <div className="sticky bottom-0 z-20 -mx-3 -mb-3 mt-auto sm:-mx-4 sm:-mb-4">
              <TablePagination
                appearance="erp"
                className="rounded-b-lg"
                currentPage={page}
                totalPages={Math.max(1, Math.ceil(query.data.total / 25))}
                totalItems={query.data.total}
                pageSize={25}
                pageSizeOptions={[25]}
                onPageChange={setPage}
                onPageSizeChange={() => {}}
              />
            </div>
          </>
        )}
      </div>

      {editor?.kind === "equipment" && (
        <EquipmentEditor api={api} record={editor.row} refs={references} onClose={close} onSaved={saved} />
      )}
      {editor && (editor.kind === "borrow" || editor.kind === "return") && (
        <EquipmentRequestPicker
          api={api}
          type={editor.kind}
          initialEquipment={editor.row}
          onClose={close}
          onSaved={saved}
        />
      )}
      {editor?.kind === "documents" && (
        <SupplyDocumentEditor api={api} record={editor.row} batchType={editor.batchType} refs={references} onClose={close} onSaved={saved} />
      )}
      {editor?.kind === "compliance" && (
        <EquipmentCompliance api={api} record={editor.row} canManage={canManage} onClose={close} onSaved={saved} />
      )}
      {preview && (
        <ErpModal native title="Chi tiết phiếu vật tư" onClose={close} maxWidth="max-w-3xl">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
              <span className="font-medium text-on-surface">{documentTypes[preview.type]}</span>
              {preview.voucherCode && <span className="font-mono text-on-surface">{preview.voucherCode}</span>}
              <span>{dayLabel(preview.voucherDay || preview.createdAt.slice(0, 10))}</span>
              <HrStatusBadge
                dot
                tone={documentStatusTone[preview.status as keyof typeof documentStatusTone] || "neutral"}
              >
                {documentLabels[preview.status]}
              </HrStatusBadge>
              {preview.reason && <span>· {preview.reason}</span>}
            </div>
            <StockRows
              rows={preview.lines.map((line, i) => ({
                ...line,
                _id: String(i),
                warehouseId: preview.warehouseId,
                revision: 1,
                createdAt: "",
                updatedAt: "",
              }))}
              api={api}
              warehouseName={warehouseName}
              ledger
            />
          </div>
        </ErpModal>
      )}
      {action?.action === "reject" && (
        <LogisticsForm
          title={action.title}
          api={api}
          path={`/logistics/${view}/${action.row._id}/action`}
          onClose={() => {
            setAction(undefined);
            restore();
          }}
          onSaved={() => {
            setAction(undefined);
            query.refresh();
            restore();
          }}
          submitLabel="Từ chối"
          payload={(data) => ({ revision: action.row.revision, action: "reject", reason: data.get("reason") })}
        >
          {(error) => <Field name="reason" label="Lý do từ chối" required error={error} />}
        </LogisticsForm>
      )}
      {action && action.action !== "reject" && (
        <ConfirmDialog
          native
          appearance="erp"
          isOpen
          title={action.title}
          description={
            action.action === "post"
              ? "Ghi sổ sẽ cập nhật tồn kho và lưu lịch sử. Phiếu đã ghi sổ không thể sửa hoặc hủy."
              : "Xác nhận thực hiện thao tác này?"
          }
          confirmLabel="Xác nhận"
          isSubmitting={busy}
          error={error}
          onClose={() => {
            if (!busy) {
              setAction(undefined);
              restore();
            }
          }}
          onConfirm={execute}
        />
      )}
    </>
  );

  if (embedded) {
    return <div className="healthcare-logistics flex min-w-0 flex-1 flex-col gap-3">{content}</div>;
  }

  return (
    <div className="healthcare-logistics flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-2 pb-0 pt-0 lg:px-0">
      <section
        aria-label={kind === "equipment" ? "Quản lý thiết bị" : "Quản lý vật tư"}
        className="flex min-h-full min-w-0 shrink-0 flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 sm:p-4"
      >
        {content}
      </section>
    </div>
  );
}
