import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeftRight,
  ArrowDownRight,
  ArrowUpRight,
  Search,
  Filter,
  Calendar,
  FileSpreadsheet,
  Clock,
  RotateCcw,
  Loader2,
  Package,
  User,
  Building2,
  TrendingUp,
  TrendingDown,
  Eye,
  X,
  ReceiptText,
  Pencil,
} from "lucide-react";
import { supplyService } from "../../services/supplyService";
import type { SupplyTransactionDocument, SupplyTransactionStats, SupplyItem } from "../../types/supply";
import { toast } from "../../pages/Toast";
import { LogisticsEmptyIllustration } from "../common/LogisticsEmptyIllustration";

interface Props {
  canManage: boolean;
  activeBranchId?: string;
  onOpenStockModal: (supply: SupplyItem | null, type: "in" | "out") => void;
  onEditDraft: (document: SupplyTransactionDocument) => void;
}

export const SupplyTransactionsView: React.FC<Props> = ({
  canManage,
  activeBranchId,
  onOpenStockModal,
  onEditDraft,
}) => {
  const [transactions, setTransactions] = useState<SupplyTransactionDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<SupplyTransactionDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Stats
  const [stats, setStats] = useState<SupplyTransactionStats>({
    totalInQty: 0,
    totalInCount: 0,
    totalOutQty: 0,
    totalOutCount: 0,
  });

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supplyService.getAllTransactions(
        {
          page,
          limit,
          search: search.trim() || undefined,
          type: typeFilter || undefined,
          status: statusFilter || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
        activeBranchId,
      );

      setTransactions(res.data || []);
      setTotal(res.total || 0);
      setStats(res.stats || { totalInQty: 0, totalInCount: 0, totalOutQty: 0, totalOutCount: 0 });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Lỗi khi tải lịch sử nhập xuất.");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, typeFilter, statusFilter, startDate, endDate, activeBranchId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTransactions();
  };

  const handleClearFilters = () => {
    setSearch("");
    setTypeFilter("");
    setStatusFilter("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const handleExportExcel = async () => {
    try {
      await supplyService.exportTransactionsExcel(
        {
          type: typeFilter || undefined,
          search: search || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
        activeBranchId,
      );
      toast.success("Đã xuất file Excel lịch sử nhập xuất kho.");
    } catch (err: any) {
      toast.error(err.message || "Lỗi xuất file Excel.");
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;
  const hasFilter = Boolean(search || typeFilter || statusFilter || startDate || endDate);

  return (
    <div className="space-y-6 text-left">
      <div className="flex items-center justify-end gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-medium transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Xuất Excel
          </button>

          {canManage && (
            <>
              <button
                type="button"
                onClick={() => onOpenStockModal(null, "in")}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-600/10 transition cursor-pointer"
              >
                <ArrowDownRight className="w-4 h-4" />
                + Nhập kho theo lô
              </button>

              <button
                type="button"
                onClick={() => onOpenStockModal(null, "out")}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-amber-600/10 transition cursor-pointer"
              >
                <ArrowUpRight className="w-4 h-4" />
                - Xuất kho theo lô
              </button>
            </>
          )}
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Tổng nhập kho</p>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">
            +{stats.totalInQty.toLocaleString("vi-VN")}
          </p>
          <p className="text-[11px] text-emerald-600/80 mt-0.5">
            {stats.totalInCount} lượt phiếu nhập
          </p>
        </div>

        <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Tổng xuất dùng</p>
            <TrendingDown className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-2">
            -{stats.totalOutQty.toLocaleString("vi-VN")}
          </p>
          <p className="text-[11px] text-amber-600/80 mt-0.5">
            {stats.totalOutCount} lượt phiếu xuất
          </p>
        </div>

        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Chênh lệch luân chuyển</p>
            <ArrowLeftRight className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-blue-700 mt-2">
            {(stats.totalInQty - stats.totalOutQty > 0 ? "+" : "")}
            {(stats.totalInQty - stats.totalOutQty).toLocaleString("vi-VN")}
          </p>
          <p className="text-[11px] text-blue-600/80 mt-0.5">
            Tổng {stats.totalInCount + stats.totalOutCount} lượt giao dịch
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tổng phiếu lọc</p>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">
            {total.toLocaleString("vi-VN")}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Trang {page} / {totalPages}
          </p>
        </div>
      </div>

      {/* Filter and Table Card */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
        {/* Filter Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/40 space-y-3">
          {/* Tầng 1: Tìm kiếm chính & Nút hành động */}
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm mã phiếu, tên/mã vật tư, số lô, người lập, bộ phận, lý do..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder-slate-400 text-slate-800 shadow-2xs transition"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md transition cursor-pointer"
                  title="Xóa tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition shadow-md shadow-emerald-600/10 active:scale-95 cursor-pointer"
              >
                <Search className="w-4 h-4" />
                <span>Lọc</span>
              </button>

              {hasFilter && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 border border-dashed border-rose-200 hover:border-rose-300 bg-rose-50/50 hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-semibold transition cursor-pointer active:scale-95"
                  title="Xóa bộ lọc"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Đặt lại</span>
                </button>
              )}
            </div>
          </form>

          {/* Tầng 2: 4 ô bộ lọc chi tiết (Loại GD, Trạng thái, Từ ngày, Đến ngày) chia đều 4 cột đối xứng */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* Lọc loại giao dịch */}
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 shadow-2xs transition">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-xs font-semibold uppercase text-slate-400 shrink-0">Loại:</span>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-transparent focus:outline-none text-slate-800 font-semibold cursor-pointer text-sm"
              >
                <option value="">Tất cả loại GD</option>
                <option value="in">Chỉ Nhập kho (+)</option>
                <option value="out">Chỉ Xuất dùng (-)</option>
              </select>
            </div>

            {/* Lọc trạng thái */}
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 shadow-2xs transition">
              <ReceiptText className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-xs font-semibold uppercase text-slate-400 shrink-0">Trạng thái:</span>
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                className="w-full bg-transparent focus:outline-none text-slate-800 font-semibold cursor-pointer text-sm"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="draft">Bản nháp</option>
                <option value="completed">Đã hoàn tất</option>
              </select>
            </div>

            {/* Lọc ngày bắt đầu */}
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 shadow-2xs transition">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-xs font-semibold uppercase text-slate-400 shrink-0">Từ:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-transparent focus:outline-none text-xs font-semibold text-slate-800 cursor-pointer"
              />
            </div>

            {/* Lọc ngày kết thúc */}
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 shadow-2xs transition">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-xs font-semibold uppercase text-slate-400 shrink-0">Đến:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-transparent focus:outline-none text-xs font-semibold text-slate-800 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-sm">Đang tải lịch sử nhập xuất kho...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <LogisticsEmptyIllustration kind="transactions" />
              <p className="text-lg font-medium text-slate-600">Chưa có phiếu nhập xuất nào</p>
              <p className="text-sm mt-1">
                Các giao dịch nhập kho và xuất dùng vật tư sẽ tự động được ghi nhận tại đây.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase border-b border-slate-100">
                  <th className="p-4 pl-6">Phiếu / Thời gian</th>
                  <th className="p-4">Loại phiếu</th>
                  <th className="p-4">Nội dung phiếu</th>
                  <th className="p-4">Tổng số lượng</th>
                  <th className="p-4">Tổng giá trị</th>
                  <th className="p-4">Người lập</th>
                  <th className="p-4">Bộ phận & Lý do</th>
                  <th className="p-4 pr-6 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                {transactions.map((t) => {
                  const isIn = t.type === "in";
                  const documentCode = t.batchCode || (isIn ? "Phiếu nhập lẻ" : "Phiếu xuất lẻ");
                  return (
                    <tr
                      key={t._id}
                      className="hover:bg-emerald-50/40 transition cursor-pointer group"
                      tabIndex={0}
                      onClick={() => setSelectedDocument(t)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedDocument(t);
                        }
                      }}
                    >
                      <td className="p-4 pl-6 whitespace-nowrap">
                        <div className="text-xs font-semibold text-slate-500 mb-1">
                          {isIn ? "Phiếu nhập kho" : "Phiếu xuất kho"}
                        </div>
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800 font-mono text-[11px] font-bold mb-1">
                          {documentCode}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(t.createdAt).toLocaleDateString("vi-VN")}</span>
                          <span className="text-slate-400 text-[11px]">
                            {new Date(t.createdAt).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </td>

                      <td className="p-4 whitespace-nowrap">
                        {isIn ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                            Nhập kho
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />
                            Xuất dùng
                          </span>
                        )}
                        <div className="mt-1.5">
                          {t.status === "draft" ? (
                            <span className="inline-flex rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                              Nháp
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                              Hoàn tất
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="font-semibold text-slate-900">
                          {t.items.length} mặt hàng
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 max-w-[240px] truncate">
                          {t.items.map((item) => item.supplyName).join(", ")}
                        </div>
                      </td>

                      <td className="p-4 whitespace-nowrap">
                        <span
                          className={`text-base font-bold ${
                            isIn ? "text-emerald-600 font-mono" : "text-amber-600 font-mono"
                          }`}
                        >
                          {isIn ? `+${t.totalQuantity}` : `-${t.totalQuantity}`}
                        </span>
                      </td>

                      <td className="p-4 whitespace-nowrap text-sm font-semibold text-slate-800">
                        {t.totalValue > 0 ? `${t.totalValue.toLocaleString("vi-VN")} đ` : "—"}
                      </td>

                      <td className="p-4 whitespace-nowrap text-xs">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t.performerName || "Nhân viên"}</span>
                        </div>
                      </td>

                      <td className="p-4 text-xs max-w-xs">
                        {t.recipientDepartment && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold mb-0.5">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            <span>{t.recipientDepartment}</span>
                          </div>
                        )}
                        <div className="text-slate-500 truncate" title={t.reason}>
                          {t.reason || (isIn ? "Nhập thêm kho" : "Xuất sử dụng")}
                        </div>
                      </td>

                      <td className="p-4 pr-6 text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedDocument(t);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 group-hover:border-emerald-200 group-hover:text-emerald-700 group-hover:bg-emerald-50 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Xem phiếu
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {total > limit && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Hiển thị {(page - 1) * limit + 1} - {Math.min(page * limit, total)} trên {total} phiếu
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Trước
              </button>
              <span className="text-xs font-semibold text-slate-700 px-2">
                Trang {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedDocument && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedDocument(null);
          }}
        >
          <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div className="flex min-w-0 items-start gap-3">
                <div className={`rounded-xl p-2.5 ${selectedDocument.type === "in" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  <ReceiptText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">
                      {selectedDocument.type === "in" ? "Chi tiết phiếu nhập kho" : "Chi tiết phiếu xuất kho"}
                    </h2>
                    <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">
                      {selectedDocument.batchCode || (selectedDocument.type === "in" ? "Phiếu nhập lẻ" : "Phiếu xuất lẻ")}
                    </span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${selectedDocument.status === "draft" ? "border-slate-300 bg-slate-100 text-slate-600" : "border-blue-200 bg-blue-50 text-blue-700"}`}>
                      {selectedDocument.status === "draft" ? "Nháp" : "Hoàn tất"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Lập lúc {new Date(selectedDocument.createdAt).toLocaleString("vi-VN")} bởi {selectedDocument.performerName || "Nhân viên"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDocument(null)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Đóng chi tiết phiếu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4 md:grid-cols-4">
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-400">Số mặt hàng</p>
                <p className="mt-1 font-bold text-slate-900">{selectedDocument.items.length}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-400">Tổng số lượng</p>
                <p className={`mt-1 font-bold ${selectedDocument.type === "in" ? "text-emerald-700" : "text-amber-700"}`}>
                  {selectedDocument.type === "in" ? "+" : "-"}{selectedDocument.totalQuantity.toLocaleString("vi-VN")}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-400">Tổng giá trị</p>
                <p className="mt-1 font-bold text-slate-900">
                  {selectedDocument.totalValue > 0 ? `${selectedDocument.totalValue.toLocaleString("vi-VN")} đ` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-400">Bộ phận / Nhà cung cấp</p>
                <p className="mt-1 truncate font-semibold text-slate-700">
                  {selectedDocument.recipientDepartment || selectedDocument.supplier || "—"}
                </p>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="w-full min-w-[850px] text-left">
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-white text-[11px] font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-3">#</th>
                    <th className="px-4 py-3">Vật tư</th>
                    <th className="px-4 py-3">Số lượng</th>
                    <th className="px-4 py-3">Tồn trước → Sau</th>
                    <th className="px-4 py-3">Lô / Hạn dùng</th>
                    <th className="px-4 py-3 text-right">Đơn giá</th>
                    <th className="px-6 py-3 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {selectedDocument.items.map((item, index) => (
                    <tr key={item._id} className="hover:bg-slate-50/70">
                      <td className="px-6 py-3 text-xs text-slate-400">{index + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{item.supplyName}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-400">{item.supplyCode}</p>
                      </td>
                      <td className={`px-4 py-3 font-mono font-bold ${selectedDocument.type === "in" ? "text-emerald-700" : "text-amber-700"}`}>
                        {selectedDocument.type === "in" ? "+" : "-"}{item.quantity.toLocaleString("vi-VN")}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                        <span className="text-slate-400">{item.balanceBefore}</span>
                        <span className="mx-1.5 text-slate-300">→</span>
                        <span className="font-bold text-slate-800">{item.balanceAfter}</span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <p className="font-mono font-semibold text-slate-700">{item.batchNumber || "—"}</p>
                        {item.expiryDate && <p className="mt-0.5 text-[11px] text-slate-400">HSD: {new Date(item.expiryDate).toLocaleDateString("vi-VN")}</p>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-medium text-slate-600">
                        {item.unitPrice != null ? `${item.unitPrice.toLocaleString("vi-VN")} đ` : "—"}
                      </td>
                      <td className="px-6 py-3 text-right text-xs font-bold text-slate-800">
                        {item.unitPrice != null ? `${(item.unitPrice * item.quantity).toLocaleString("vi-VN")} đ` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Lý do:</span>{" "}
                {selectedDocument.reason || (selectedDocument.type === "in" ? "Nhập thêm kho" : "Xuất sử dụng")}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {selectedDocument.status === "draft" && canManage && (
                  <button
                    type="button"
                    onClick={() => {
                      const document = selectedDocument;
                      setSelectedDocument(null);
                      onEditDraft(document);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    <Pencil className="h-4 w-4" />
                    Sửa phiếu nháp
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedDocument(null)}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
