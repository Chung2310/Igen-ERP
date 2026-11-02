import React from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  PackageSearch,
  Pencil,
  RotateCcw,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { StockLog } from "../../../types";
import { Dropdown, DropdownOption } from "../../common/Dropdown";
import {
  formatLogDate,
  formatNumber,
  getInitials,
  getLogItems,
  getLogStatus,
  getLogTitle,
  getStatusTone,
  isPosSalesLog,
  TransactionStatus,
} from "./stockLogUtils";

interface StockLogTableProps {
  logs: StockLog[];
  paginatedLogs: StockLog[];
  isLoading?: boolean;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  totalPages: number;
  statusUpdatingId: string | null;
  readOnly?: boolean;
  onSelectLog: (log: StockLog) => void;
  onEditLog: (log: StockLog) => void;
  onDeleteLog?: (id: string) => void;
  onUpdateStatus?: (logId: string, nextStatus: TransactionStatus) => Promise<void>;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
}

const statusOptions: DropdownOption<TransactionStatus>[] = [
  { value: "Đang chờ", label: "Đang chờ" },
  { value: "Đang xử lý", label: "Đang xử lý" },
  { value: "Hoàn thành", label: "Hoàn thành" },
];

export function StockLogTable({
  logs,
  paginatedLogs,
  isLoading = false,
  currentPage,
  setCurrentPage,
  pageSize,
  totalPages,
  statusUpdatingId,
  readOnly = false,
  onSelectLog,
  onEditLog,
  onDeleteLog,
  onUpdateStatus,
  onResetFilters,
  hasActiveFilters,
}: StockLogTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3 min-w-[170px]">Mã phiếu / Thời gian</th>
              <th className="px-4 py-3 min-w-[140px]">Loại giao dịch</th>
              <th className="px-4 py-3 min-w-[280px]">Nội dung & Sản phẩm</th>
              <th className="px-4 py-3 text-right min-w-[120px]">Biến động SL</th>
              <th className="px-4 py-3 min-w-[150px]">Người phụ trách</th>
              <th className="px-4 py-3 min-w-[130px]">Trạng thái</th>
              <th className="sticky right-0 bg-slate-50/95 px-4 py-3 text-center min-w-[110px] shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.05)] backdrop-blur-xs">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, n) => (
                <tr key={n} className="animate-pulse">
                  <td className="px-4 py-3.5">
                    <div className="h-4 w-24 rounded bg-slate-200 mb-1.5" />
                    <div className="h-3 w-28 rounded bg-slate-100" />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="h-6 w-20 rounded-full bg-slate-100" />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="h-4 w-48 rounded bg-slate-200 mb-1.5" />
                    <div className="h-3 w-32 rounded bg-slate-100" />
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="h-5 w-14 rounded bg-slate-200 ml-auto" />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="h-4 w-24 rounded bg-slate-200" />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="h-6 w-20 rounded-full bg-slate-100" />
                  </td>
                  <td className="sticky right-0 bg-white px-4 py-3.5 text-center shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.05)]">
                    <div className="h-7 w-16 rounded bg-slate-200 mx-auto" />
                  </td>
                </tr>
              ))
            ) : paginatedLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <PackageSearch className="h-6 w-6" />
                  </div>
                  <p className="mt-3 font-bold text-slate-800">Không tìm thấy giao dịch nào</p>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                    Không có phiếu nào khớp với điều kiện tìm kiếm hoặc bộ lọc hiện tại. Thử đổi từ khóa hoặc đặt lại bộ lọc.
                  </p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={onResetFilters}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                      Đặt lại bộ lọc
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              paginatedLogs.map((log) => {
                const items = getLogItems(log);
                const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
                const isInbound = log.type === "nhập";
                const isPos = isPosSalesLog(log);
                const status = getLogStatus(log);

                return (
                  <tr key={log.id} className="group transition-colors hover:bg-slate-50/70">
                    {/* Cột 1: Mã phiếu & Thời gian */}
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex font-mono text-[11px] font-bold text-slate-800 bg-slate-100/90 border border-slate-200/80 px-2 py-0.5 rounded-md shadow-2xs">
                          {log.id}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock className="h-3 w-3 shrink-0 text-slate-400" />
                        <span>{formatLogDate(log.createdAt)}</span>
                      </div>
                    </td>

                    {/* Cột 2: Loại giao dịch & Nguồn gốc */}
                    <td className="px-4 py-3 align-middle">
                      {isInbound ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/90 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 shadow-2xs">
                          <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />
                          Nhập kho
                        </span>
                      ) : isPos ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 rounded-full border border-sky-200/90 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 shadow-2xs">
                            <ShoppingCart className="h-3.5 w-3.5 text-sky-600" />
                            Bán POS
                          </span>
                          <span className="block text-[10px] font-medium text-slate-400 pl-1">
                            Đơn hàng POS
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200/90 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 shadow-2xs">
                            <ArrowUpRight className="h-3.5 w-3.5 text-rose-600" />
                            Xuất kho
                          </span>
                          {log.purpose && (
                            <span className="block text-[10px] font-medium text-slate-400 pl-1 capitalize">
                              {log.purpose === "bán"
                                ? "Bán hàng"
                                : log.purpose === "chuyển kho"
                                ? "Chuyển kho"
                                : log.purpose === "nội bộ"
                                ? "Nội bộ"
                                : log.purpose === "hủy"
                                ? "Hủy / hỏng"
                                : log.purpose}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Cột 3: Nội dung & Sản phẩm */}
                    <td className="px-4 py-3 align-middle">
                      <div className="font-semibold text-slate-900 text-xs line-clamp-1">
                        {getLogTitle(log)}
                      </div>

                      {/* Chips tóm tắt sản phẩm */}
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px]">
                        {items.slice(0, 2).map((item, idx) => (
                          <span
                            key={`${item.sku}-${idx}`}
                            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600"
                          >
                            <span className="max-w-[140px] truncate text-slate-800">
                              {item.productName}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">({item.sku})</span>
                          </span>
                        ))}
                        {items.length > 2 && (
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                            +{items.length - 2} sp khác
                          </span>
                        )}
                      </div>

                      {/* Đối tác / Ghi chú */}
                      {(log.customerName || log.notes) && (
                        <div className="mt-0.5 text-[10px] text-slate-400 truncate max-w-xs">
                          {log.customerName && (
                            <span className="text-slate-600 font-medium">
                              Khách: {log.customerName} ·{" "}
                            </span>
                          )}
                          {log.notes && <span>{log.notes}</span>}
                        </div>
                      )}
                    </td>

                    {/* Cột 4: Biến động số lượng */}
                    <td className="px-4 py-3 text-right align-middle">
                      <div
                        className={`text-sm font-extrabold tabular-nums ${
                          isInbound ? "text-emerald-600" : isPos ? "text-sky-700" : "text-rose-600"
                        }`}
                      >
                        {isInbound ? "+" : "-"}
                        {formatNumber(totalQuantity)}{" "}
                        <span className="text-[11px] font-medium text-slate-400">sp</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {items.length} dòng hàng
                      </div>
                    </td>

                    {/* Cột 5: Người phụ trách */}
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-700 shadow-2xs">
                          {getInitials(log.operatorName)}
                        </div>
                        <span className="truncate font-medium text-slate-700">
                          {log.operatorName || "Chưa rõ"}
                        </span>
                      </div>
                    </td>

                    {/* Cột 6: Trạng thái */}
                    <td className="px-4 py-3 align-middle">
                      {!readOnly && onUpdateStatus ? (
                        <div className="w-28">
                          <Dropdown<TransactionStatus>
                            value={status}
                            disabled={statusUpdatingId === log.id}
                            onChange={(nextStatus) => {
                              if (nextStatus !== status) {
                                void onUpdateStatus(log.id, nextStatus);
                              }
                            }}
                            options={statusOptions}
                            variant="subtle"
                            size="xs"
                            className="w-full"
                          />
                        </div>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold shadow-2xs ${getStatusTone(
                            status
                          )}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              status === "Hoàn thành"
                                ? "bg-emerald-500"
                                : status === "Đang xử lý"
                                ? "bg-amber-500"
                                : "bg-slate-400"
                            }`}
                          />
                          {status}
                        </span>
                      )}
                    </td>

                    {/* Cột 7: Thao tác (Sticky Right) */}
                    <td className="sticky right-0 bg-white/95 px-3 py-3 text-center shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.05)] backdrop-blur-xs group-hover:bg-slate-50/95 align-middle">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Nút Xem chi tiết */}
                        <button
                          type="button"
                          onClick={() => onSelectLog(log)}
                          aria-label="Xem chi tiết"
                          title="Xem chi tiết"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-2xs transition-colors hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span className="sr-only">Xem chi tiết</span>
                        </button>

                        {/* Nút Sửa phiếu */}
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => onEditLog(log)}
                            aria-label="Sửa phiếu"
                            title="Sửa phiếu"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 shadow-2xs transition-colors hover:bg-blue-100"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">Sửa phiếu</span>
                          </button>
                        )}

                        {/* Nút Xóa */}
                        {!readOnly && onDeleteLog && (
                          <button
                            type="button"
                            onClick={() => onDeleteLog(log.id)}
                            aria-label="Xóa"
                            title="Xóa phiếu"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 shadow-2xs transition-colors hover:bg-red-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Xóa</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Phân trang ── */}
      {logs.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200/80 bg-slate-50/50 px-4 py-3 text-xs text-slate-500">
          <div>
            Hiển thị{" "}
            <span className="font-bold text-slate-800">
              {Math.min((currentPage - 1) * pageSize + 1, logs.length)}
            </span>
            {" - "}
            <span className="font-bold text-slate-800">
              {Math.min(currentPage * pageSize, logs.length)}
            </span>{" "}
            trong tổng số{" "}
            <span className="font-bold text-slate-800">{formatNumber(logs.length)}</span> giao dịch
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Trước</span>
              </button>

              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && p - prev > 1;
                    return (
                      <React.Fragment key={p}>
                        {showEllipsis && <span className="px-1 text-slate-400">…</span>}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={`h-8 min-w-[32px] rounded-lg px-2 text-xs font-semibold transition-colors ${
                            currentPage === p
                              ? "bg-teal-700 text-white shadow-xs"
                              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span>Sau</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
