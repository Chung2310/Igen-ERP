import { useMemo, useState } from "react";
import { ArrowRight, ArrowRightLeft, Check, History, X } from "lucide-react";
import { Dropdown } from "./GymDropdown";
import { ErpRefreshButton } from "../../components/common/ErpRefreshButton";
import { ErpTableHead } from "../../components/common/ErpTableHead";
import { TablePagination } from "../../components/common/TablePagination";
import { HrStatusBadge } from "../../components/hr/HrStatusBadge";
import type { GymList, GymRecord, GymTrainer } from "../../../shared/gym/types";
import { cn } from "../student-management/lib/utils";
import type { GymApi } from "./api";
import {
  Feedback,
  GymAvatar,
  GymEmptyState,
  dateLabel,
  messageOf,
  primary,
  useGymQuery,
} from "./ui";

const REASON_PRESETS = [
  "Đổi ca tập theo nguyện vọng học viên",
  "PT cũ nghỉ phép / chuyển cơ sở",
  "Điều phối lại khối lượng công việc giữa các PT",
  "Học viên yêu cầu đổi Huấn luyện viên mới",
] as const;

const REASON_PRESET_STYLES = [
  "bg-[#E8F7FF] text-[#006FAD] hover:bg-[#D7F1FF]",
  "bg-[#DCFCE7] text-[#087A37] hover:bg-[#BBF7D0]",
  "bg-[#FEE2E2] text-[#C62828] hover:bg-[#FECACA]",
  "bg-[#F3E8FF] text-[#7C3AED] hover:bg-[#E9D5FF]",
] as const;
const STATUS_META: Record<string, { label: string; tone: "warning" | "success" | "danger" | "neutral" | "violet" }> = {
  PENDING: { label: "Chờ duyệt", tone: "warning" },
  ACCEPTED: { label: "Đã chấp nhận", tone: "success" },
  REJECTED: { label: "Đã từ chối", tone: "danger" },
  CANCELLED: { label: "Đã hủy", tone: "neutral" },
  ADMIN_FORCED: { label: "Admin chuyển", tone: "violet" },
};

export default function TransfersPage({
  api,
  admin = true,
  currentUserId = "",
}: {
  api: GymApi;
  admin?: boolean;
  currentUserId?: string;
}) {
  const [tab, setTab] = useState<"create" | "history">("create");
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [customerId, setCustomerId] = useState("");
  const [batchIds, setBatchIds] = useState<Set<string>>(new Set());
  const [batchSearch, setBatchSearch] = useState("");
  const [toPtId, setToPtId] = useState("");
  const [reason, setReason] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit, setHistoryLimit] = useState(15);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [refresh, setRefresh] = useState(0);

  const transfersQuery = useGymQuery<GymList>(api, `/transfers?page=${historyPage}&limit=${historyLimit}${statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : ""}`, refresh);
  const pendingQuery = useGymQuery<GymList>(api, "/transfers?status=PENDING&limit=1", refresh);
  const customersQuery = useGymQuery<GymList>(api, "/customers?limit=200", refresh);
  const trainersQuery = useGymQuery<GymTrainer[]>(api, "/trainers", refresh);
  const selectedCustomerDetail = useGymQuery<GymRecord>(
    api,
    customerId ? `/customers/${customerId}` : "/customers?limit=1",
    refresh,
  );

  const transfers = transfersQuery.data?.data || [];
  const customers = customersQuery.data?.data || [];
  const trainers = trainersQuery.data || [];

  const trainerMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of trainers) map.set(t._id, t.displayName);
    return map;
  }, [trainers]);

  const availableTrainers = useMemo(() => {
    if (mode === "batch") return trainers;
    return trainers.filter(t => t._id !== selectedCustomerDetail.data?.assignedPtId);
  }, [trainers, selectedCustomerDetail.data?.assignedPtId, mode]);

  const filteredBatchCustomers = useMemo(() => {
    const q = batchSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      c =>
        String(c.fullName || "").toLowerCase().includes(q) ||
        String(c.phone || "").toLowerCase().includes(q),
    );
  }, [customers, batchSearch]);

  const filteredTransfers = transfers;
  const pendingCount = pendingQuery.data?.meta.total || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setSubmitError("");
    setSubmitSuccess("");

    if (!toPtId) {
      setSubmitError("Vui lòng chọn huấn luyện viên tiếp nhận.");
      return;
    }
    if (!reason.trim()) {
      setSubmitError("Vui lòng nhập hoặc chọn lý do điều chuyển.");
      return;
    }

    if (admin && mode === "batch") {
      if (!batchIds.size) {
        setSubmitError("Vui lòng chọn ít nhất 1 khách hàng cần điều chuyển hàng loạt.");
        return;
      }
      setBusy(true);
      try {
        const res = await api.request<{ movedCount: number; skippedCount: number }>("/transfers/batch", "POST", {
          customerIds: Array.from(batchIds),
          toPtId,
          reason: reason.trim(),
        });
        setBatchIds(new Set());
        setToPtId("");
        setReason("");
        setSubmitSuccess(
          `Đã điều chuyển ${res.movedCount} khách hàng thành công${res.skippedCount ? ` (bỏ qua ${res.skippedCount} khách đã thuộc PT này)` : ""}.`,
        );
        setRefresh(r => r + 1);
      } catch (err) {
        setSubmitError(messageOf(err));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!customerId) {
      setSubmitError("Vui lòng chọn khách hàng cần điều chuyển.");
      return;
    }

    setBusy(true);
    try {
      if (admin) {
        if (!selectedCustomerDetail.data?.revision) {
          throw new Error("Đang tải thông tin khách hàng, vui lòng thử lại sau giây lát.");
        }
        await api.request("/transfers", "POST", {
          customerId,
          toPtId,
          reason: reason.trim(),
          revision: selectedCustomerDetail.data.revision,
        });
        setSubmitSuccess("Đã điều chuyển khách hàng thành công.");
      } else {
        await api.request("/transfers/request", "POST", {
          customerId,
          toPtId,
          reason: reason.trim(),
        });
        setSubmitSuccess("Đã gửi đề xuất điều chuyển, chờ huấn luyện viên tiếp nhận xác nhận.");
      }
      setCustomerId("");
      setToPtId("");
      setReason("");
      setRefresh(r => r + 1);
    } catch (err) {
      setSubmitError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const handleAction = async (id: string, action: "accept" | "reject" | "cancel" | "approve") => {
    if (busy) return;
    setBusy(true);
    setSubmitError("");
    setSubmitSuccess("");
    try {
      await api.request(`/transfers/${id}/${action}`, "PATCH");
      setRefresh(r => r + 1);
    } catch (err) {
      setSubmitError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const renderHistoryTable = () => (
    <div className="space-y-3 rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h3 data-typography="section-title" className="text-sm font-semibold text-on-surface">
            Lịch sử &amp; yêu cầu điều chuyển
          </h3>
          <span className="text-xs tabular-nums text-on-surface-variant">({filteredTransfers.length})</span>
        </div>
        <Dropdown
          aria-label="Lọc theo trạng thái"
          variant="filter"
          value={statusFilter}
          onChange={value => { setStatusFilter(value); setHistoryPage(1); }}
          options={[
            { value: "", label: "Tất cả trạng thái" },
            { value: "PENDING", label: "Chờ duyệt" },
            { value: "ACCEPTED", label: "Đã chấp nhận" },
            { value: "ADMIN_FORCED", label: "Admin chuyển" },
            { value: "REJECTED", label: "Đã từ chối" },
            { value: "CANCELLED", label: "Đã hủy" },
          ]}
        />
      </div>

      <Feedback error={transfersQuery.error || submitError} loading={transfersQuery.loading} />
      {!transfersQuery.loading && !transfersQuery.error && (
        <div className="overflow-x-auto rounded-md border border-outline-variant">
          <table className="min-w-[780px] w-full border-collapse text-left text-sm tabular-nums">
            <ErpTableHead
              appearance="healthcare"
              columns={["Học viên", "Chuyển giao", "Lý do", "Trạng thái", "Thời gian", "Thao tác"]}
            />
            <tbody className="divide-y divide-outline-variant [&>tr]:transition-colors [&>tr:hover]:bg-surface-container-low/40">
              {filteredTransfers.map(row => {
                const st = STATUS_META[row.status] || { label: row.status || "Đã chuyển", tone: "neutral" as const };
                const isPending = row.status === "PENDING";
                const canAccept = isPending && (admin || row.toPtId === currentUserId);
                const canCancel = isPending && (admin || row.fromPtId === currentUserId || row.requestedById === currentUserId);
                return (
                  <tr key={row._id}>
                    <td className="px-3 py-2.5 align-middle">
                      <div className="flex items-center gap-2.5">
                        <GymAvatar name={row.customerName} size="sm" />
                        <span className="font-medium text-on-surface">{row.customerName}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-middle text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-on-surface-variant">{trainerMap.get(row.fromPtId) || row.fromPtName || "Chưa gán"}</span>
                        <ArrowRight className="size-3.5 text-primary" aria-hidden="true" />
                        <strong className="text-change-up">{row.toPtName || trainerMap.get(row.toPtId) || "—"}</strong>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 align-middle text-xs text-on-surface-variant">{row.reason || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                      <HrStatusBadge tone={st.tone} className="normal-case">{st.label}</HrStatusBadge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-middle text-xs text-on-surface-variant">
                      {dateLabel(row.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right align-middle">
                      {isPending ? (
                        <div className="flex items-center justify-end gap-1.5">
                          {canAccept && (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleAction(row._id, admin ? "approve" : "accept")}
                                className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-change-up/40 bg-change-up/10 px-2 text-xs font-medium text-change-up hover:bg-change-up/20"
                              >
                                <Check className="size-3.5" aria-hidden="true" />
                                Duyệt
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleAction(row._id, "reject")}
                                className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-error/30 bg-error-container/20 px-2 text-xs font-medium text-error hover:bg-error-container/40"
                              >
                                <X className="size-3.5" aria-hidden="true" />
                                Từ chối
                              </button>
                            </>
                          )}
                          {canCancel && !canAccept && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleAction(row._id, "cancel")}
                              className="inline-flex h-7 cursor-pointer items-center rounded-md border border-outline-variant px-2 text-xs font-medium text-on-surface-variant hover:text-error"
                            >
                              Hủy
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-on-surface-variant">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!filteredTransfers.length && (
                <tr>
                  <td colSpan={6} className="p-4">
                    <GymEmptyState kind="workflow" title="Chưa có lịch sử điều chuyển." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {transfersQuery.data && <TablePagination appearance="erp" currentPage={historyPage} totalPages={transfersQuery.data.meta.totalPages} pageSize={historyLimit} totalItems={transfersQuery.data.meta.total} pageSizeOptions={[15, 25, 50]} onPageChange={setHistoryPage} onPageSizeChange={value => { setHistoryLimit(value); setHistoryPage(1); }} />}
    </div>
  );

  return (
    <section className="space-y-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3 sm:p-4" aria-label="Điều chuyển">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant">
        <nav aria-label="Điều chuyển" className="flex gap-1 overflow-x-auto">
          {([
            ["create", admin ? "Tạo lệnh chuyển" : "Đề xuất chuyển", ArrowRightLeft],
            ["history", `Lịch sử (${transfersQuery.data?.meta.total || 0})${pendingCount ? ` · ${pendingCount} chờ` : ""}`, History],
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
        <div className="pb-1.5">
          <ErpRefreshButton loading={transfersQuery.loading || customersQuery.loading} onClick={() => setRefresh(r => r + 1)} />
        </div>
      </div>

      {tab === "create" && (
        <div className="space-y-3">
          <form onSubmit={handleSubmit} className="space-y-4 rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {!admin && (
                <h3 data-typography="section-title" className="text-sm font-semibold text-on-surface">
                  Đề xuất điều chuyển khách hàng
                </h3>
              )}
              {admin && (
                <div className="inline-flex rounded-md border border-outline-variant bg-surface-container-low/50 p-0.5 text-xs">
                  {([
                    ["single", "Chuyển 1 khách"],
                    ["batch", "Chuyển hàng loạt"],
                  ] as const).map(([k, lbl]) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={mode === k}
                      onClick={() => { setMode(k); setSubmitError(""); setSubmitSuccess(""); }}
                      className={cn(
                        "cursor-pointer rounded px-2.5 py-1 font-medium transition-colors",
                        mode === k ? "bg-surface-container-lowest text-primary shadow-2xs" : "text-on-surface-variant hover:text-on-surface",
                      )}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {admin && mode === "batch" ? (
              <div className="space-y-3">
                <div className="space-y-2 rounded-md border border-outline-variant bg-surface-container-low/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-on-surface">
                      Chọn khách hàng ({batchIds.size} đã chọn) <span className="text-error">*</span>
                    </span>
                    <input
                      type="text"
                      aria-label="Tìm khách hàng chuyển hàng loạt"
                      placeholder="Tìm tên hoặc SĐT..."
                      value={batchSearch}
                      onChange={e => setBatchSearch(e.target.value)}
                      className="h-8 w-56 rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 text-xs text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                  <div className="grid max-h-48 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                    {filteredBatchCustomers.map(c => {
                      const checked = batchIds.has(c._id);
                      return (
                        <label
                          key={c._id}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                            checked ? "border-primary/50 bg-primary/5" : "border-outline-variant bg-surface-container-lowest",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="size-3.5 accent-primary"
                            checked={checked}
                            onChange={() => {
                              setBatchIds(prev => {
                                const next = new Set(prev);
                                if (next.has(c._id)) next.delete(c._id);
                                else next.add(c._id);
                                return next;
                              });
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-on-surface">{c.fullName}</span>
                            <span className="block truncate text-[11px] text-on-surface-variant">
                              {trainerMap.get(c.assignedPtId) || "Chưa gán PT"}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="block text-xs font-medium text-on-surface">
                    Huấn luyện viên tiếp nhận <span className="text-error">*</span>
                  </span>
                  <Dropdown
                    aria-label="Chọn huấn luyện viên tiếp nhận"
                    variant="filter"
                    searchable
                    searchPlaceholder="Tìm huấn luyện viên..."
                    className="w-full"
                    triggerClassName="w-full justify-between"
                    value={toPtId}
                    onChange={val => { setToPtId(val); setSubmitError(""); }}
                    options={[
                      { value: "", label: "Chọn huấn luyện viên..." },
                      ...availableTrainers.map(t => ({
                        value: t._id,
                        label: `${t.displayName} (${t.customerCount} khách)`,
                      })),
                    ]}
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <span className="block text-xs font-medium text-on-surface">
                    Khách hàng <span className="text-error">*</span>
                  </span>
                  <Dropdown
                    aria-label="Chọn khách hàng"
                    variant="filter"
                    searchable
                    searchPlaceholder="Nhập tên khách hoặc SĐT..."
                    className="w-full"
                    triggerClassName="w-full justify-between"
                    value={customerId}
                    onChange={val => {
                      setCustomerId(val);
                      setToPtId("");
                      setSubmitError("");
                      setSubmitSuccess("");
                    }}
                    options={[
                      { value: "", label: "Chọn khách hàng..." },
                      ...customers.map(c => ({
                        value: c._id,
                        label: `${c.fullName}${c.phone ? ` — ${c.phone}` : ""}`,
                      })),
                    ]}
                  />
                </div>

                <div className="space-y-1">
                  <span className="block text-xs font-medium text-on-surface">
                    Huấn luyện viên tiếp nhận <span className="text-error">*</span>
                  </span>
                  <Dropdown
                    aria-label="Chọn huấn luyện viên tiếp nhận"
                    variant="filter"
                    searchable
                    searchPlaceholder="Tìm huấn luyện viên..."
                    className="w-full"
                    triggerClassName="w-full justify-between"
                    value={toPtId}
                    onChange={val => {
                      setToPtId(val);
                      setSubmitError("");
                    }}
                    options={[
                      { value: "", label: "Chọn huấn luyện viên..." },
                      ...availableTrainers.map(t => ({
                        value: t._id,
                        label: `${t.displayName} (${t.customerCount} khách)`,
                      })),
                    ]}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-medium text-on-surface">
                Lý do điều chuyển <span className="text-error">*</span>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Nhập lý do điều chuyển..."
                  className="mt-1.5 w-full rounded-md border border-outline-variant bg-surface-container-lowest p-2.5 text-sm text-on-surface outline-none transition focus:border-primary"
                />
              </label>
              <div className="flex flex-wrap gap-1.5">
                {REASON_PRESETS.map((preset, index) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setReason(preset)}
                    aria-pressed={reason === preset}
                    className={cn(
                      "inline-flex max-w-full min-h-8 cursor-pointer items-center rounded-lg px-2.5 py-1 text-left text-xs font-semibold leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                      REASON_PRESET_STYLES[index],
                      reason === preset && "ring-1 ring-current",
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {submitError && <Feedback error={submitError} />}
            {submitSuccess && (
              <p role="status" className="rounded-lg border border-change-up/35 bg-change-up/10 px-3 py-2 text-xs font-medium text-change-up">
                {submitSuccess}
              </p>
            )}

            <div className="flex justify-end">
              <button type="submit" disabled={busy} className={cn(primary, "min-h-9")}>
                <ArrowRightLeft className="size-3.5" aria-hidden="true" />
                {busy
                  ? "Đang xử lý..."
                  : admin && mode === "batch"
                    ? `Điều chuyển ${batchIds.size} khách hàng`
                    : admin
                      ? "Xác nhận điều chuyển"
                      : "Gửi đề xuất điều chuyển"}
              </button>
            </div>
          </form>

          {renderHistoryTable()}
        </div>
      )}

      {tab === "history" && renderHistoryTable()}
    </section>
  );
}
