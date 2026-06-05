import React, { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, Eye, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { ProductItem, StockLog } from "../../types";

type DraftLine = {
  productId: string;
  quantity: string;
};

type TransactionStatus = "Đang chờ" | "Đang xử lý" | "Hoàn thành";

type DraftPayload = {
  id?: string;
  type: "nhập" | "xuất";
  title: string;
  operatorName: string;
  notes: string;
  status: TransactionStatus;
  items: Array<{ productId: string; quantity: number }>;
};

type StockLogPanelProps = {
  products: ProductItem[];
  searchLog: string;
  setSearchLog: (value: string) => void;
  stockLogs: StockLog[];
  isLoading?: boolean;
  onExportExcel: () => void;
  onImportExcel: () => void;
  isImporting?: boolean;
  onNavigateToCreateProduct: () => void;
  onCreateTransaction: (payload: DraftPayload) => Promise<void>;
  onUpdateTransaction: (payload: DraftPayload) => Promise<void>;
  onDeleteTransaction?: (logId: string) => Promise<void>;
};

function formatNumber(value: number) {
  return value.toLocaleString("vi-VN");
}

function getLogStatus(log: StockLog): TransactionStatus {
  const status = String(log.status);
  if (status === "Đang chờ" || status === "Đang xử lý" || status === "Hoàn thành") {
    return status;
  }
  return status === "Thành công" ? "Hoàn thành" : "Đang xử lý";
}

function getStatusTone(status: TransactionStatus) {
  if (status === "Hoàn thành") return "bg-sky-50 text-sky-700";
  if (status === "Đang xử lý") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function getStatusKey(status: TransactionStatus) {
  const normalized = String(status).toLowerCase();
  if (normalized.startsWith("h")) return "completed";
  if (normalized.includes("x")) return "processing";
  return "pending";
}

function getTypeKey(type: StockLog["type"]) {
  return String(type).toLowerCase().startsWith("x") ? "outbound" : "inbound";
}

function getLogItems(log: StockLog): Array<{ productId?: string; sku: string; productName: string; quantity: number }> {
  const typedLog = log as StockLog & {
    items?: Array<{ productId?: string; sku: string; productName: string; quantity: number }>;
  };

  if (typedLog.items?.length) {
    return typedLog.items;
  }

  return [{ sku: log.sku, productName: log.productName, quantity: log.quantity }];
}

function getLogTitle(log: StockLog) {
  const typedLog = log as StockLog & { title?: string };
  if (typedLog.title) return typedLog.title;
  return `${log.type === "nhập" ? "Nhập kho" : "Xuất kho"}: ${log.productName}`;
}

export function StockLogPanel({
  products,
  searchLog,
  setSearchLog,
  stockLogs,
  isLoading = false,
  onExportExcel,
  onImportExcel,
  isImporting = false,
  onNavigateToCreateProduct,
  onCreateTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
}: StockLogPanelProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<StockLog | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [draftType, setDraftType] = useState<"nhập" | "xuất">("nhập");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftOperator, setDraftOperator] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftStatus, setDraftStatus] = useState<TransactionStatus>("Đang chờ");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([{ productId: "", quantity: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "inbound" | "outbound">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "processing" | "completed">("all");

  const filteredLogs = useMemo(
    () =>
      stockLogs.filter((log) => {
        const keyword = searchLog.toLowerCase();
        const itemText = getLogItems(log)
          .map((item) => `${item.productName} ${item.sku}`)
          .join(" ")
          .toLowerCase();

        const matchesType = typeFilter === "all" || getTypeKey(log.type) === typeFilter;
        const matchesStatus = statusFilter === "all" || getStatusKey(getLogStatus(log)) === statusFilter;
        const matchesKeyword =
          log.id.toLowerCase().includes(keyword) ||
          getLogTitle(log).toLowerCase().includes(keyword) ||
          itemText.includes(keyword);

        return matchesType && matchesStatus && matchesKeyword;
      }),
    [searchLog, statusFilter, stockLogs, typeFilter]
  );

  const resetDraft = () => {
    setEditingLogId(null);
    setDraftType("nhập");
    setDraftTitle("");
    setDraftOperator("");
    setDraftNotes("");
    setDraftStatus("Đang chờ");
    setDraftLines([{ productId: "", quantity: "" }]);
  };

  const openCreateModal = () => {
    resetDraft();
    setShowCreateModal(true);
  };

  const openEditModal = (log: StockLog) => {
    const items = getLogItems(log);
    setEditingLogId(log.id);
    setDraftType(log.type as "nhập" | "xuất");
    setDraftTitle(getLogTitle(log));
    setDraftOperator(log.operatorName);
    setDraftNotes(log.notes);
    setDraftStatus(getLogStatus(log));
    setDraftLines(
      items.map((item) => {
        const matchedProduct = products.find((product) => product.sku === item.sku);
        return {
          productId: matchedProduct?.id || "",
          quantity: String(item.quantity),
        };
      })
    );
    setShowCreateModal(true);
  };

  const addDraftLine = () => {
    setDraftLines((current) => [...current, { productId: "", quantity: "" }]);
  };

  const updateDraftLine = (index: number, nextLine: DraftLine) => {
    setDraftLines((current) => current.map((line, lineIndex) => (lineIndex === index ? nextLine : line)));
  };

  const removeDraftLine = (index: number) => {
    setDraftLines((current) => (current.length === 1 ? current : current.filter((_, lineIndex) => lineIndex !== index)));
  };

  const submitDraft = async (event: React.FormEvent) => {
    event.preventDefault();

    const normalizedItems = draftLines
      .map((line) => ({
        productId: line.productId,
        quantity: Number(line.quantity),
      }))
      .filter((line) => line.productId && Number.isFinite(line.quantity) && line.quantity > 0);

    if (!draftTitle.trim() || !draftOperator.trim() || normalizedItems.length === 0) {
      return;
    }

    setSubmitting(true);

    const payload: DraftPayload = {
      id: editingLogId || undefined,
      type: draftType,
      title: draftTitle.trim(),
      operatorName: draftOperator.trim(),
      notes: draftNotes.trim(),
      status: draftStatus,
      items: normalizedItems,
    };

    try {
      if (editingLogId) {
        await onUpdateTransaction(payload);
      } else {
        await onCreateTransaction(payload);
      }
      setShowCreateModal(false);
      resetDraft();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5" id="stock_transactions_list">
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-xs" id="log_filters_bar">
        <div className="flex flex-wrap items-end gap-3">

          {/* ── Bộ lọc ── */}
          <div className="relative min-w-48 flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Tìm mọi phiếu, sản phẩm..."
              className="h-9 w-full rounded-lg border border-gray-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 placeholder:text-gray-400 transition-colors focus:border-slate-300 focus:bg-white focus:outline-none"
              value={searchLog}
              onChange={(event) => setSearchLog(event.target.value)}
            />
          </div>

          <label className="flex shrink-0 flex-col gap-1">
            <span className="px-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Loại phiếu</span>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as "all" | "inbound" | "outbound")}
              className="h-9 w-40 rounded-lg border border-gray-200 bg-white px-3 text-sm text-slate-700 focus:outline-none"
            >
              <option value="all">Tất cả phiếu</option>
              <option value="inbound">Phiếu nhập</option>
              <option value="outbound">Phiếu xuất</option>
            </select>
          </label>

          <label className="flex shrink-0 flex-col gap-1">
            <span className="px-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Trạng thái</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | "pending" | "processing" | "completed")}
              className="h-9 w-44 rounded-lg border border-gray-200 bg-white px-3 text-sm text-slate-700 focus:outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Đang chờ</option>
              <option value="processing">Đang xử lý</option>
              <option value="completed">Hoàn thành</option>
            </select>
          </label>

          {/* ── Ngăn cách ── */}
          <div className="hidden h-7 w-px shrink-0 bg-gray-200 sm:block" />

          {/* ── Hành động ── */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onImportExcel}
              disabled={isImporting}
              className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {isImporting ? "Đang nhập..." : "Nhập Excel"}
            </button>
            <button
              type="button"
              onClick={onExportExcel}
              className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              <Download className="h-3.5 w-3.5" />
              Xuất Excel
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-800"
            >
              <Plus className="h-4 w-4" />
              Tạo phiếu
            </button>
          </div>

        </div>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="animate-pulse flex flex-col gap-4 rounded-2xl border border-gray-150 bg-gray-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="h-12 w-12 rounded-2xl bg-gray-200 shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-1/3 bg-gray-200 rounded" />
                      <div className="h-3.5 w-1/2 bg-gray-200 rounded" />
                      <div className="h-3 w-1/4 bg-gray-200 rounded" />
                    </div>
                  </div>
                  <div className="flex items-end gap-2 flex-col sm:items-end">
                    <div className="h-8 w-20 bg-gray-200 rounded" />
                    <div className="h-8 w-44 bg-gray-200 rounded mt-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredLogs.map((log) => {
            const items = getLogItems(log);
            const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
            const previewText = items.map((item) => item.productName).join(", ");
            const isInbound = log.type === "nhập";
            const status = getLogStatus(log);

            return (
              <div key={log.id} className="flex flex-col gap-4 rounded-2xl border border-sky-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${isInbound ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    {isInbound ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-bold text-slate-800">{getLogTitle(log)}</h4>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{log.id}</span>
                    </div>
                    <p className="mt-1 truncate text-sm text-gray-500">{previewText}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span>{log.operatorName}</span>
                      <span>{log.createdAt}</span>
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${getStatusTone(status)}`}>{status}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                  <div className={`text-right text-3xl font-bold ${isInbound ? "text-emerald-600" : "text-rose-600"}`}>
                    {isInbound ? "+" : "-"}
                    {formatNumber(totalQuantity)}
                    <span className="ml-1 text-lg font-semibold text-gray-400">sp</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(log)}
                      className="flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100"
                    >
                      <Pencil className="h-4 w-4" />
                      Sửa phiếu
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLog(log);
                        setShowDetailModal(true);
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <Eye className="h-4 w-4" />
                      Xem chi tiết
                    </button>
                    {onDeleteTransaction && (
                      <button
                        type="button"
                        onClick={() => onDeleteTransaction(log.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition-colors hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4" />
                        Xóa
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredLogs.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
              <p className="font-bold text-gray-700">Chưa có phiếu phù hợp</p>
              <p className="mt-1 text-sm text-gray-500">Tạo phiếu mới hoặc thử đổi từ khóa tìm kiếm.</p>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{editingLogId ? "Chỉnh sửa phiếu nhập xuất kho" : "Tạo phiếu nhập xuất kho"}</h3>
                <p className="text-sm text-gray-500">Chọn loại phiếu, trạng thái xử lý, thêm sản phẩm có sẵn và số lượng cần xử lý.</p>
              </div>
              <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="space-y-5" onSubmit={submitDraft}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setDraftType("nhập")}
                  className={`rounded-2xl border px-4 py-3 text-left ${draftType === "nhập" ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-white"}`}
                >
                  <div className="text-sm font-bold text-slate-800">Phiếu nhập hàng</div>
                  <div className="mt-1 text-xs text-gray-500">Cộng tồn kho cho sản phẩm được chọn.</div>
                </button>
                <button
                  type="button"
                  onClick={() => setDraftType("xuất")}
                  className={`rounded-2xl border px-4 py-3 text-left ${draftType === "xuất" ? "border-rose-200 bg-rose-50" : "border-gray-200 bg-white"}`}
                >
                  <div className="text-sm font-bold text-slate-800">Phiếu xuất hàng</div>
                  <div className="mt-1 text-xs text-gray-500">Trừ tồn kho theo từng sản phẩm trong phiếu.</div>
                </button>
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Trạng thái phiếu</span>
                  <select
                    value={draftStatus}
                    onChange={(event) => setDraftStatus(event.target.value as TransactionStatus)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
                  >
                    <option value="Đang chờ">Đang chờ</option>
                    <option value="Đang xử lý">Đang xử lý</option>
                    <option value="Hoàn thành">Hoàn thành</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Tên phiếu</span>
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    placeholder={draftType === "nhập" ? "Ví dụ: Nhập hàng từ nhà cung cấp A" : "Ví dụ: Xuất kho cho đại lý Hà Nội"}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Người phụ trách</span>
                  <input
                    type="text"
                    value={draftOperator}
                    onChange={(event) => setDraftOperator(event.target.value)}
                    placeholder="Nhập tên người phụ trách"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
                  />
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Ghi chú</span>
                <textarea
                  value={draftNotes}
                  onChange={(event) => setDraftNotes(event.target.value)}
                  placeholder="Mô tả ngắn nội dung phiếu hoặc lưu ý vận hành"
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
                />
              </label>

              <div className="rounded-2xl border border-gray-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-bold text-slate-800">Danh sách sản phẩm trong phiếu</h4>
                  <button type="button" onClick={addDraftLine} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">
                    Thêm dòng
                  </button>
                </div>

                {draftType === "nhập" && (
                  <div className="mb-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900">
                    Chưa có sản phẩm cần nhập?
                    <button
                      type="button"
                      onClick={onNavigateToCreateProduct}
                      className="ml-2 font-bold underline underline-offset-2"
                    >
                      Chuyển sang Danh mục để khai báo sản phẩm
                    </button>
                  </div>
                )}

                <div className="space-y-3">
                  {draftLines.map((line, index) => (
                    <div key={`${index}-${line.productId}`} className="grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-slate-50 p-3 md:grid-cols-[1fr_140px_44px]">
                      <label className="space-y-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Sản phẩm</span>
                        <select
                          value={line.productId}
                          onChange={(event) => updateDraftLine(index, { ...line, productId: event.target.value })}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                        >
                          <option value="">Chọn sản phẩm</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} - {product.sku} ({formatNumber(product.stock)})
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Số lượng</span>
                        <input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(event) => updateDraftLine(index, { ...line, quantity: event.target.value })}
                          placeholder="0"
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => removeDraftLine(index)}
                        className="mt-6 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                      >
                        <X className="mx-auto h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  Đóng
                </button>
                <button type="submit" disabled={submitting} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
                  {submitting ? (editingLogId ? "Đang cập nhật phiếu..." : "Đang tạo phiếu...") : editingLogId ? "Cập nhật phiếu" : "Lưu phiếu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailModal && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{getLogTitle(selectedLog)}</h3>
                <p className="text-sm text-gray-500">
                  {selectedLog.id} • {selectedLog.createdAt}
                </p>
              </div>
              <button type="button" onClick={() => setShowDetailModal(false)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-slate-50 p-4 md:grid-cols-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Loại phiếu</div>
                <div className="mt-1 text-sm font-bold text-slate-800">{selectedLog.type === "nhập" ? "Nhập kho" : "Xuất kho"}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Phụ trách</div>
                <div className="mt-1 text-sm font-bold text-slate-800">{selectedLog.operatorName}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Trạng thái</div>
                <div className="mt-1 text-sm font-bold text-slate-800">{getLogStatus(selectedLog)}</div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {getLogItems(selectedLog).map((item, index) => (
                <div key={`${item.sku}-${index}`} className="flex items-center justify-between rounded-2xl border border-gray-200 px-4 py-3">
                  <div>
                    <div className="font-bold text-slate-800">{item.productName}</div>
                    <div className="mt-1 text-xs text-gray-500">SKU: {item.sku}</div>
                  </div>
                  <div className={`text-lg font-bold ${selectedLog.type === "nhập" ? "text-emerald-600" : "text-rose-600"}`}>
                    {selectedLog.type === "nhập" ? "+" : "-"}
                    {formatNumber(item.quantity)}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 p-4 text-sm text-gray-600">
              <div className="font-semibold text-slate-800">Ghi chú</div>
              <div className="mt-1">{selectedLog.notes || "Không có ghi chú bổ sung."}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
