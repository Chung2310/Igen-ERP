import { useEffect, useMemo, useState } from "react";
import { Calendar, Check, ChevronDown, ChevronUp, Eye, Layers, Pencil, Plus, ScanLine, Trash2, UploadCloud, UserPlus } from "lucide-react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { Dropdown } from "./GymDropdown";
import { ErpModal } from "../../components/common/ErpModal";
import { ErpRefreshButton } from "../../components/common/ErpRefreshButton";
import { ErpTableHead } from "../../components/common/ErpTableHead";
import { primaryCreateButtonClass } from "../../components/common/primaryCreateButton";
import { TableFilterToolbar } from "../../components/common/TableFilterToolbar";
import { TablePagination } from "../../components/common/TablePagination";
import type { GymList, GymRecord } from "../../../shared/gym/types";
import { cn } from "../student-management/lib/utils";
import type { GymApi } from "./api";
import CustomerForm from "./CustomerForm";
import InBodyDetailModal from "./InBodyDetailModal";
import RecordEditor from "./RecordEditor";
import InBodyEvolution from "./InBodyEvolution";
import { dateLabel, Feedback, Field, GymAvatar, GymEmptyState, messageOf, secondary, useGymQuery } from "./ui";

const iconActionClass =
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors hover:border-primary/40 hover:bg-surface-container hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary";

const dangerIconActionClass =
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-error/30 bg-surface-container-lowest text-error transition-colors hover:bg-error-container/30 focus-visible:outline-2 focus-visible:outline-primary";

function classifyBodyFat(value?: number, gender?: string) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  if (gender === "FEMALE") {
    if (value < 18) return { label: "Rất thấp", cls: "text-primary" };
    if (value <= 28) return { label: "Lý tưởng", cls: "text-change-up" };
    if (value <= 33) return { label: "Trung bình", cls: "text-tertiary" };
    return { label: "Mỡ cao", cls: "text-error" };
  }
  if (value < 10) return { label: "Rất thấp", cls: "text-primary" };
  if (value <= 20) return { label: "Lý tưởng", cls: "text-change-up" };
  if (value <= 25) return { label: "Trung bình", cls: "text-tertiary" };
  return { label: "Mỡ cao", cls: "text-error" };
}

function classifyVisceralFat(level?: number) {
  if (typeof level !== "number" || Number.isNaN(level)) return "text-on-surface";
  if (level <= 9) return "text-change-up";
  if (level <= 14) return "text-tertiary";
  return "text-error";
}

export default function InBodyPage({
  api,
  canWrite,
  customerId: fixedCustomerId,
}: {
  api: GymApi;
  canWrite: boolean;
  customerId?: string;
  embedded?: boolean;
}) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(fixedCustomerId || "");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "DRAFT" | "PUBLISHED">("ALL");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<
    | GymRecord
    | "new"
    | { initialValues: Record<string, any>; customerId?: string }
  >();
  const [scanOpen, setScanOpen] = useState(false);
  const [detail, setDetail] = useState<GymRecord>();
  const [deleting, setDeleting] = useState<GymRecord>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = () => setRevision(v => v + 1);
  const togglePublish = async (row: GymRecord) => {
    setBusy(true); setError("");
    try {
      const updated = await api.request<GymRecord>(`/measurements/${row._id}/${row.status === "PUBLISHED" ? "unpublish" : "publish"}`, "PATCH", { revision: row.revision });
      setDetail(current => current?._id === row._id ? updated : current);
      refresh();
    } catch (cause) { setError(messageOf(cause)); } finally { setBusy(false); }
  };
  const customersQuery = useGymQuery<GymList>(api, "/customers?limit=100", revision);
  const customerMap = useMemo(() => {
    const map = new Map<string, GymRecord>();
    for (const c of customersQuery.data?.data || []) map.set(c._id, c);
    return map;
  }, [customersQuery.data]);

  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(search ? { search } : {}),
    ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
    ...(fixedCustomerId || selectedCustomerId ? { customerId: fixedCustomerId || selectedCustomerId } : {}),
  });
  const result = useGymQuery<GymList>(api, `/measurements?${query}`, revision);
  const rows = result.data?.data || [];
  const activeCustomerId = fixedCustomerId || selectedCustomerId;
  const [fullHistory, setFullHistory] = useState<GymRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!activeCustomerId) {
      setFullHistory([]);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    (async () => {
      try {
        const first = await api.request<GymList>(
          `/measurements?customerId=${encodeURIComponent(activeCustomerId)}&page=1&limit=100`,
          "GET",
        );
        const collected = [...(first.data || [])];
        const totalPages = Math.min(10, first.meta?.totalPages || 1);
        for (let p = 2; p <= totalPages; p++) {
          if (cancelled) return;
          const next = await api.request<GymList>(
            `/measurements?customerId=${encodeURIComponent(activeCustomerId)}&page=${p}&limit=100`,
            "GET",
          );
          collected.push(...(next.data || []));
        }
        if (!cancelled) setFullHistory(collected);
      } catch {
        if (!cancelled) setFullHistory([]);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, activeCustomerId, revision]);

  return (
    <section className="flex min-h-full flex-1 flex-col gap-3" aria-label="Chỉ số InBody">
      <div className="flex flex-1 flex-col gap-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3 sm:p-4">
        <TableFilterToolbar
          appearance="plain"
          actions={
            <>
              <ErpRefreshButton loading={result.loading} onClick={refresh} />
              {canWrite && (
                <>
                  <button
                    type="button"
                    className={secondary}
                    onClick={() => setEditor("new")}
                  >
                    <Plus className="size-3.5 stroke-[2.5]" aria-hidden="true" />
                    Nhập thủ công
                  </button>
                  <button
                    type="button"
                    className={cn(primaryCreateButtonClass, "min-h-9")}
                    onClick={() => setScanOpen(true)}
                  >
                    <ScanLine className="size-3.5" aria-hidden="true" />
                    Quét phiếu InBody
                  </button>
                </>
              )}
            </>
          }
          search={{
            value: search,
            onChange: value => { setSearch(value); setPage(1); },
            placeholder: "Tìm ghi chú, chỉ số...",
            ariaLabel: "Tìm phiếu đo InBody",
            className: "min-w-0",
          }}
          totalCount={result.data?.meta.total}
          countLabel="lần đo"
          hasActiveFilters={Boolean(search.trim() || statusFilter !== "ALL" || (!fixedCustomerId && selectedCustomerId))}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("ALL");
            if (!fixedCustomerId) setSelectedCustomerId("");
            setPage(1);
          }}
        >
          <div className="flex gap-1 rounded-md border border-outline-variant bg-surface-container-low p-1" role="tablist" aria-label="Trạng thái phiếu InBody">{([ ["ALL", "Tất cả"], ["PUBLISHED", "Đã công bố"], ["DRAFT", "Bản nháp"] ] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={statusFilter === value} className={`rounded px-2 py-1 text-xs ${statusFilter === value ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant"}`} onClick={() => { setStatusFilter(value); setPage(1); }}>{label}</button>)}</div>
          {!fixedCustomerId && (
            <Dropdown
              aria-label="Lọc theo học viên"
              variant="filter"
              searchable
              searchPlaceholder="Tìm tên hoặc SĐT..."
              value={selectedCustomerId}
              onChange={value => { setSelectedCustomerId(value); setPage(1); }}
              options={[
                { value: "", label: "Tất cả học viên" },
                ...(customersQuery.data?.data || []).map(c => ({
                  value: c._id,
                  label: `${c.fullName}${c.phone ? ` · ${c.phone}` : ""}`,
                })),
              ]}
            />
          )}
        </TableFilterToolbar>

        <Feedback error={result.error || error} loading={result.loading} />

        {activeCustomerId && !historyLoading && fullHistory.length > 0 && <InBodyEvolution records={fullHistory} />}

        {!result.loading && !result.error && (
          <div className="flex-1 overflow-x-auto rounded-md border border-outline-variant bg-surface-container-lowest">
            <table className="min-w-[920px] w-full border-collapse text-left text-sm tabular-nums">
              <ErpTableHead
                appearance="healthcare"
                columns={[
                  ...(!fixedCustomerId ? ["Học viên"] : []),
                  "Ngày đo",
                  "Nguồn",
                  "Trạng thái",
                  "Cân nặng",
                  "% Mỡ",
                  "Khối lượng cơ",
                  "Mỡ nội tạng",
                  "BMI / BMR",
                  "Thao tác",
                ]}
              />
              <tbody className="divide-y divide-outline-variant [&>tr]:transition-colors [&>tr:hover]:bg-surface-container-low/40">
                {rows.map(row => {
                  const customer = customerMap.get(row.customerId);
                  const fatMeta = classifyBodyFat(row.bodyFatPercentage, customer?.gender);
                  const musclePct =
                    typeof row.muscleMass === "number" && typeof row.weight === "number" && row.weight > 0
                      ? Math.round((row.muscleMass / row.weight) * 1000) / 10
                      : null;
                  return (
                    <tr key={row._id}>
                      {!fixedCustomerId && (
                        <td className="px-3 py-2.5 align-middle">
                          <div className="flex items-center gap-2.5">
                            <GymAvatar name={customer?.fullName || row.customerName} />
                            <div className="min-w-0">
                              <span className="block truncate font-medium text-on-surface">
                                {customer?.fullName || row.customerName || "Học viên"}
                              </span>
                              {customer?.phone && (
                                <span className="block text-xs text-on-surface-variant">{customer.phone}</span>
                              )}
                            </div>
                          </div>
                        </td>
                      )}
                      <td className="whitespace-nowrap px-3 py-2.5 align-middle text-xs text-on-surface">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="size-3.5 text-on-surface-variant" aria-hidden="true" />
                          {dateLabel(row.measurementDate)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-middle text-xs">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                            row.source === "OCR"
                              ? "bg-primary/10 text-primary"
                              : "bg-surface-container text-on-surface-variant",
                          )}
                        >
                          {row.source === "OCR" ? "Quét tự động" : "Thủ công"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-middle text-xs"><span className={row.status === "PUBLISHED" ? "text-change-up" : "text-on-surface-variant"}>{row.status === "PUBLISHED" ? "Đã công bố" : "Bản nháp"}</span></td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                        {row.weight != null ? (
                          <span className="inline-flex rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                            {row.weight} kg
                          </span>
                        ) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                        {row.bodyFatPercentage != null ? (
                          <div>
                            <span className="block font-semibold text-on-surface">{row.bodyFatPercentage}%</span>
                            {fatMeta && <span className={cn("block text-xs font-medium", fatMeta.cls)}>{fatMeta.label}</span>}
                          </div>
                        ) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                        {row.muscleMass != null ? (
                          <div>
                            <span className="block font-semibold text-change-up">{row.muscleMass} kg</span>
                            {musclePct != null && (
                              <span className="block text-xs text-on-surface-variant">~{musclePct}%</span>
                            )}
                          </div>
                        ) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                        {row.visceralFatLevel != null || row.inbodyScore != null ? (
                          <div>
                            {row.visceralFatLevel != null && (
                              <span className={cn("block font-semibold", classifyVisceralFat(row.visceralFatLevel))}>
                                Level {row.visceralFatLevel}
                              </span>
                            )}
                            {row.inbodyScore != null && (
                              <span className="block text-xs text-on-surface-variant">
                                Score: {row.inbodyScore}/100
                              </span>
                            )}
                          </div>
                        ) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-middle text-xs">
                        {row.bmi != null || row.bmr != null ? (
                          <div className="space-y-0.5">
                            {row.bmi != null && (
                              <span className="block text-on-surface-variant">
                                BMI: <strong className="text-on-surface">{row.bmi}</strong>
                              </span>
                            )}
                            {row.bmr != null && (
                              <span className="block text-on-surface-variant">
                                BMR: <strong className="text-on-surface">{row.bmr} kcal</strong>
                              </span>
                            )}
                          </div>
                        ) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right align-middle">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            aria-label="Chi tiết phiếu đo"
                            title="Xem chi tiết"
                            className={iconActionClass}
                            onClick={() => setDetail(row)}
                          >
                            <Eye className="size-4" aria-hidden="true" />
                          </button>
                          {canWrite && (
                            <>
                              <button type="button" disabled={busy} aria-label={row.status === "PUBLISHED" ? "Thu hồi phiếu InBody" : "Công bố phiếu InBody"} title={row.status === "PUBLISHED" ? "Thu hồi về bản nháp" : "Công bố cho học viên"} className={iconActionClass} onClick={() => void togglePublish(row)}><Check className="size-4" aria-hidden="true" /></button>
                              <button
                                type="button"
                                aria-label="Sửa phiếu đo"
                                title="Sửa"
                                className={iconActionClass}
                                onClick={() => setEditor(row)}
                              >
                                <Pencil className="size-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                aria-label="Xóa phiếu đo"
                                title="Xóa"
                                className={dangerIconActionClass}
                                onClick={() => { setError(""); setDeleting(row); }}
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan={fixedCustomerId ? 9 : 10} className="p-4">
                      <GymEmptyState
                        kind="task"
                        filtered={Boolean(search.trim() || (!fixedCustomerId && selectedCustomerId))}
                        title="Chưa có phiếu đo InBody."
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
            pageSizeOptions={[10, 15, 25, 50]}
            onPageChange={setPage}
            onPageSizeChange={size => { setLimit(size); setPage(1); }}
          />
        )}
      </div>

      {editor && (
        <RecordEditor
          api={api}
          entity="measurements"
          record={editor === "new" || "initialValues" in editor ? undefined : editor}
          customerId={
            (editor !== "new" && "initialValues" in editor && editor.customerId) ||
            fixedCustomerId ||
            selectedCustomerId ||
            undefined
          }
          initialValues={
            editor !== "new" && "initialValues" in editor ? editor.initialValues : undefined
          }
          onClose={() => setEditor(undefined)}
          onSaved={() => { setEditor(undefined); refresh(); }}
        />
      )}

      {scanOpen && (
        <InBodyScanModal
          api={api}
          customers={customersQuery.data?.data || []}
          fixedCustomerId={fixedCustomerId || selectedCustomerId || ""}
          onClose={() => setScanOpen(false)}
          onSaved={() => {
            setScanOpen(false);
            refresh();
          }}
          onCustomerCreated={() => refresh()}
          onOpenFullEditor={(result) => {
            setScanOpen(false);
            setEditor({
              initialValues: result.extracted,
              customerId: result.matchedCustomerId || fixedCustomerId || selectedCustomerId || undefined,
            });
          }}
        />
      )}

      {detail && (
        <InBodyDetailModal
          api={api}
          record={detail}
          customer={customerMap.get(detail.customerId)}
          historyRecords={activeCustomerId === detail.customerId && fullHistory.length > 0 ? fullHistory : undefined}
          canWrite={canWrite}
          onClose={() => setDetail(undefined)}
          onEdit={(rec) => {
            setDetail(undefined);
            setEditor(rec);
          }}
          onStatusChanged={(updated) => {
            setDetail(updated);
            refresh();
          }}
        />
      )}

      <ConfirmDialog
        native
        appearance="erp"
        isOpen={Boolean(deleting)}
        title="Xóa phiếu đo InBody?"
        description="Dữ liệu đã xóa không thể khôi phục."
        confirmLabel="Xóa vĩnh viễn"
        isSubmitting={busy}
        error={error}
        onClose={() => { if (!busy) setDeleting(undefined); }}
        onConfirm={async () => {
          if (!deleting) return;
          setBusy(true);
          try {
            await api.remove("measurements", deleting);
            setDeleting(undefined);
            refresh();
          } catch (e) {
            setError(messageOf(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </section>
  );
}

function formatInBodyWarning(text: string): string {
  const t = text.trim();
  const lower = t.toLowerCase();
  if (lower.includes("segmental fat") && lower.includes("estimated"))
    return "Chỉ số phân bố mỡ từng phần (tay, chân, thân) là giá trị ước tính từ thuật toán máy đo.";
  if ((lower.includes("segmental lean") || lower.includes("segmental muscle")) && lower.includes("estimated"))
    return "Chỉ số phân bố cơ từng phần (tay, chân, thân) là giá trị ước tính từ thuật toán máy đo.";
  if (lower.includes("ecw") && lower.includes("estimated"))
    return "Tỷ lệ nước ngoại bào (ECW/TBW) là số liệu ước tính từ điện trở kháng.";
  if (lower.includes("body composition") && lower.includes("estimated"))
    return "Thành phần cơ thể là số liệu ước tính từ dòng điện sinh học BIA.";
  if (lower.includes("blurry") || lower.includes("blur") || lower.includes("unclear"))
    return "Ảnh chụp phiếu đo có vùng hơi mờ, PT vui lòng đối chiếu kỹ lại số đo trên phiếu gốc.";
  return t;
}

const SEGMENTAL_PARTS = [
  { key: "rightArm", label: "Tay phải" },
  { key: "leftArm", label: "Tay trái" },
  { key: "trunk", label: "Thân mình" },
  { key: "rightLeg", label: "Chân phải" },
  { key: "leftLeg", label: "Chân trái" },
] as const;

function InBodyScanModal({
  api,
  customers,
  fixedCustomerId,
  onClose,
  onSaved,
  onCustomerCreated,
  onOpenFullEditor,
}: {
  api: GymApi;
  customers: GymRecord[];
  fixedCustomerId: string;
  onClose: () => void;
  onSaved: () => void;
  onCustomerCreated?: () => void;
  onOpenFullEditor: (result: {
    extracted: Record<string, any>;
    matchedCustomerId: string;
  }) => void;
}) {
  const [customerId, setCustomerId] = useState(fixedCustomerId);
  const [extraCustomers, setExtraCustomers] = useState<GymRecord[]>([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [showSegmental, setShowSegmental] = useState(false);
  const [measurementDate, setMeasurementDate] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [scanResult, setScanResult] = useState<{
    extracted: Record<string, any>;
    matchedCustomerId: string;
    detectedCustomerName: string | null;
    confidence: number;
    warnings: string[];
  } | null>(null);
  const [reviewForm, setReviewForm] = useState<Record<string, any>>({});
  const allCustomers = useMemo(() => {
    const map = new Map<string, GymRecord>();
    for (const c of [...customers, ...extraCustomers]) map.set(c._id, c);
    return [...map.values()];
  }, [customers, extraCustomers]);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming?.length) return;
    const next = [...files, ...Array.from(incoming)].slice(0, 5);
    setFiles(next);
    setError("");
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!files.length) {
      setError("Vui lòng chọn ít nhất 1 ảnh hoặc file PDF phiếu InBody.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = new FormData();
      for (const f of files) data.append("file", f);
      if (customerId) data.append("customerId", customerId);
      if (measurementDate) data.append("measurementDate", measurementDate);
      const res = await api.request<{
        extracted: Record<string, any>;
        matchedCustomerId: string;
        detectedCustomerName: string | null;
        confidence?: number;
        warnings?: string[];
      }>("/measurements/scan", "POST", data);
      const nextCid = res.matchedCustomerId || customerId || fixedCustomerId || "";
      setCustomerId(nextCid);
      setReviewForm(res.extracted || {});
      setScanResult({
        extracted: res.extracted || {},
        matchedCustomerId: nextCid,
        detectedCustomerName: res.detectedCustomerName || null,
        confidence: typeof res.confidence === "number" ? res.confidence : 0.85,
        warnings: Array.isArray(res.warnings) ? res.warnings : [],
      });
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!customerId) {
      setError("Vui lòng chọn học viên trước khi lưu phiếu đo InBody.");
      return;
    }
    const weightNum = Number(reviewForm.weight);
    if (!Number.isFinite(weightNum) || weightNum <= 0) {
      setError("Vui lòng kiểm tra lại chỉ số Cân nặng (kg).");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, any> = {
        customerId,
        measurementDate: reviewForm.measurementDate || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }),
        weight: weightNum,
      };
      const numericKeys = [
        "height", "bmi", "bodyFatPercentage", "bodyFatMass", "muscleMass",
        "bmr", "visceralFatLevel", "inbodyScore", "bodyWater", "boneMineral",
        "waistHipRatio", "waist", "hip", "chest",
      ];
      for (const k of numericKeys) {
        if (reviewForm[k] !== "" && reviewForm[k] !== null && reviewForm[k] !== undefined) {
          const n = Number(reviewForm[k]);
          if (Number.isFinite(n)) payload[k] = n;
        }
      }
      if (reviewForm.segmentalMuscle) payload.segmentalMuscle = reviewForm.segmentalMuscle;
      if (reviewForm.segmentalFat) payload.segmentalFat = reviewForm.segmentalFat;
      if (reviewForm.notes) payload.notes = String(reviewForm.notes).trim();
      await api.save("measurements", payload);
      onSaved();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ErpModal
      native
      title={scanResult ? "Kiểm tra & xác nhận phiếu InBody" : "Quét phiếu InBody"}
      onClose={() => { if (!busy && !saving) onClose(); }}
      closeDisabled={busy || saving}
      maxWidth="max-w-2xl"
    >
      {!scanResult ? (
        <form className="space-y-4" onSubmit={handleScan} aria-busy={busy}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="block text-sm text-on-surface">Khách hàng</span>
              <Dropdown
                aria-label="Chọn khách hàng"
                variant="filter"
                searchable
                searchPlaceholder="Nhập tên khách hoặc SĐT..."
                className="w-full"
                triggerClassName="w-full justify-between"
                value={customerId}
                onChange={setCustomerId}
                options={[
                  { value: "", label: "Để trống để AI tự nhận diện" },
                  ...customers.map(c => ({
                    value: c._id,
                    label: `${c.fullName}${c.phone ? ` · ${c.phone}` : ""}`,
                  })),
                ]}
              />
            </div>
            <Field
              label="Ngày đo"
              type="date"
              value={measurementDate}
              onChange={setMeasurementDate}
              disabled={busy}
            />
          </div>

          <div className="space-y-1.5">
            <span className="block text-sm text-on-surface">Ảnh hoặc File PDF phiếu InBody * (tối đa 5 file)</span>
            <label
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                addFiles(e.dataTransfer.files);
              }}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-primary/40 bg-surface-container-low/40 px-4 py-7 text-center transition-colors hover:border-primary hover:bg-primary/5"
            >
              <UploadCloud className="size-8 text-primary" aria-hidden="true" />
              <span className="text-sm font-medium text-on-surface">
                {files.length ? `Đã chọn ${files.length} tệp` : "Kéo thả ảnh hoặc PDF phiếu InBody vào đây"}
              </span>
              <span className="text-xs text-on-surface-variant">Hỗ trợ JPG, PNG, WebP hoặc PDF (kể cả PDF scan)</span>
              <input
                type="file"
                multiple
                className="sr-only"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                disabled={busy}
                onChange={e => addFiles(e.target.files)}
              />
            </label>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {files.map((f, idx) => (
                  <span key={`${f.name}-${idx}`} className="inline-flex items-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-low px-2 py-1 text-xs text-on-surface">
                    <span className="max-w-[200px] truncate">{f.name}</span>
                    <button
                      type="button"
                      aria-label={`Bỏ tệp ${f.name}`}
                      disabled={busy}
                      onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                      className="cursor-pointer text-error hover:opacity-80"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <Feedback error={error} />

          <div className="flex justify-end gap-2 border-t border-outline-variant pt-3">
            <button type="button" className={secondary} disabled={busy} onClick={onClose}>
              Hủy
            </button>
            <button type="submit" disabled={busy || !files.length} className={cn(primaryCreateButtonClass, "min-h-9")}>
              <ScanLine className="size-3.5" aria-hidden="true" />
              {busy ? "Đang quét OCR..." : "Quét InBody"}
            </button>
          </div>
        </form>
      ) : (
        <form className="space-y-3" onSubmit={handleConfirmSave} aria-busy={saving}>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
            <span className="text-on-surface">
              Độ tin cậy OCR: <strong className="text-primary">{Math.round(scanResult.confidence * 100)}%</strong>
              {scanResult.detectedCustomerName && (
                <> · Tên trên phiếu: <strong>{scanResult.detectedCustomerName}</strong></>
              )}
            </span>
            <button
              type="button"
              onClick={() => onOpenFullEditor({ extracted: reviewForm, matchedCustomerId: customerId })}
              className="cursor-pointer font-medium text-primary hover:underline"
            >
              Mở form đầy đủ
            </button>
          </div>

          {scanResult.warnings.length > 0 && (
            <div className="rounded-md border border-tertiary/40 bg-tertiary-container/30 px-3 py-2 text-xs text-on-surface">
              <p className="font-semibold">Lưu ý kiểm tra từ phiếu đo:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {scanResult.warnings.map((w, i) => <li key={i}>{formatInBodyWarning(w)}</li>)}
              </ul>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="block text-sm text-on-surface">
                  Học viên <span className="text-error">*</span>
                </span>
                <button
                  type="button"
                  onClick={() => setQuickAddOpen(true)}
                  className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <UserPlus className="size-3.5" aria-hidden="true" />
                  Thêm nhanh học viên
                </button>
              </div>
              <Dropdown
                aria-label="Chọn học viên"
                variant="filter"
                searchable
                searchPlaceholder="Nhập tên khách hoặc SĐT..."
                className="w-full"
                triggerClassName="w-full justify-between"
                value={customerId}
                onChange={setCustomerId}
                options={[
                  { value: "", label: "Chọn học viên..." },
                  ...allCustomers.map(c => ({
                    value: c._id,
                    label: `${c.fullName}${c.phone ? ` · ${c.phone}` : ""}`,
                  })),
                ]}
              />
            </div>
            <Field
              label="Ngày đo"
              type="date"
              value={reviewForm.measurementDate || ""}
              onChange={v => setReviewForm(p => ({ ...p, measurementDate: v }))}
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Field label="Cân nặng (kg)" type="number" required value={reviewForm.weight ?? ""} onChange={v => setReviewForm(p => ({ ...p, weight: v }))} disabled={saving} />
            <Field label="Chiều cao (cm)" type="number" value={reviewForm.height ?? ""} onChange={v => setReviewForm(p => ({ ...p, height: v }))} disabled={saving} />
            <Field label="% Mỡ (PBF)" type="number" value={reviewForm.bodyFatPercentage ?? ""} onChange={v => setReviewForm(p => ({ ...p, bodyFatPercentage: v }))} disabled={saving} />
            <Field label="Cơ xương (kg)" type="number" value={reviewForm.muscleMass ?? ""} onChange={v => setReviewForm(p => ({ ...p, muscleMass: v }))} disabled={saving} />
            <Field label="Mỡ cơ thể (kg)" type="number" value={reviewForm.bodyFatMass ?? ""} onChange={v => setReviewForm(p => ({ ...p, bodyFatMass: v }))} disabled={saving} />
            <Field label="BMI" type="number" value={reviewForm.bmi ?? ""} onChange={v => setReviewForm(p => ({ ...p, bmi: v }))} disabled={saving} />
            <Field label="BMR (kcal)" type="number" value={reviewForm.bmr ?? ""} onChange={v => setReviewForm(p => ({ ...p, bmr: v }))} disabled={saving} />
            <Field label="Mỡ nội tạng" type="number" value={reviewForm.visceralFatLevel ?? ""} onChange={v => setReviewForm(p => ({ ...p, visceralFatLevel: v }))} disabled={saving} />
            <Field label="Điểm InBody" type="number" value={reviewForm.inbodyScore ?? ""} onChange={v => setReviewForm(p => ({ ...p, inbodyScore: v }))} disabled={saving} />
            <Field label="Nước cơ thể (L)" type="number" value={reviewForm.bodyWater ?? ""} onChange={v => setReviewForm(p => ({ ...p, bodyWater: v }))} disabled={saving} />
            <Field label="Khoáng xương (kg)" type="number" value={reviewForm.boneMineral ?? ""} onChange={v => setReviewForm(p => ({ ...p, boneMineral: v }))} disabled={saving} />
            <Field label="Tỷ lệ eo/hông" type="number" value={reviewForm.waistHipRatio ?? ""} onChange={v => setReviewForm(p => ({ ...p, waistHipRatio: v }))} disabled={saving} />
          </div>

          <div className="overflow-hidden rounded-md border border-outline-variant bg-surface-container-low/40">
            <button
              type="button"
              aria-expanded={showSegmental}
              onClick={() => setShowSegmental(v => !v)}
              className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container"
            >
              <span className="inline-flex items-center gap-1.5 text-primary">
                <Layers className="size-3.5" aria-hidden="true" />
                Phân tích cơ &amp; mỡ từng phân vùng (Segmental)
              </span>
              {showSegmental ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
            {showSegmental && (
              <div className="space-y-3 border-t border-outline-variant bg-surface-container-lowest p-3">
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-change-up">Khối lượng cơ từng phần (kg)</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {SEGMENTAL_PARTS.map(part => (
                      <Field
                        key={`m-${part.key}`}
                        label={part.label}
                        type="number"
                        value={reviewForm.segmentalMuscle?.[part.key] ?? ""}
                        disabled={saving}
                        onChange={v =>
                          setReviewForm(p => ({
                            ...p,
                            segmentalMuscle: { ...(p.segmentalMuscle || {}), [part.key]: v === "" ? null : Number(v) },
                          }))
                        }
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-tertiary">Khối lượng mỡ từng phần (kg)</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {SEGMENTAL_PARTS.map(part => (
                      <Field
                        key={`f-${part.key}`}
                        label={part.label}
                        type="number"
                        value={reviewForm.segmentalFat?.[part.key] ?? ""}
                        disabled={saving}
                        onChange={v =>
                          setReviewForm(p => ({
                            ...p,
                            segmentalFat: { ...(p.segmentalFat || {}), [part.key]: v === "" ? null : Number(v) },
                          }))
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Feedback error={error} />

          <div className="flex justify-between gap-2 border-t border-outline-variant pt-3">
            <button type="button" className={secondary} disabled={saving} onClick={() => setScanResult(null)}>
              Quét lại
            </button>
            <div className="flex gap-2">
              <button type="button" className={secondary} disabled={saving} onClick={onClose}>
                Hủy
              </button>
              <button type="submit" disabled={saving || !customerId} className={cn(primaryCreateButtonClass, "min-h-9")}>
                <Check className="size-3.5" aria-hidden="true" />
                {saving ? "Đang lưu..." : "Xác nhận & lưu phiếu đo"}
              </button>
            </div>
          </div>
        </form>
      )}
      {quickAddOpen && (
        <CustomerForm
          api={api}
          initialValues={{
            fullName: scanResult?.detectedCustomerName || "",
            height: reviewForm.height ?? "",
            initialWeight: reviewForm.weight ?? "",
          }}
          onClose={() => setQuickAddOpen(false)}
          onSaved={(created) => {
            setQuickAddOpen(false);
            if (created?._id) {
              setExtraCustomers(prev => [...prev, created]);
              setCustomerId(created._id);
            }
            onCustomerCreated?.();
          }}
        />
      )}
    </ErpModal>
  );
}
