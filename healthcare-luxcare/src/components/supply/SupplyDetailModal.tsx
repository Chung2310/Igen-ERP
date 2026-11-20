import { canIssueSupply, supplyBusinessDay } from "../../../shared/supply-stock";
import React, { useState, useEffect } from "react";
import {
  X,
  Package,
  Calendar,
  Clock,
  MapPin,
  Building2,
  ShieldCheck,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  Edit2,
  History,
  Tag,
  FileText,
  Boxes,
  Loader2,
  ExternalLink,
  Eye,
} from "lucide-react";
import type { SupplyItem, SupplyTransaction } from "../../types/supply";
import { supplyService } from "../../services/supplyService";

interface Props {
  isOpen: boolean;
  supply: SupplyItem | null;
  activeBranchId?: string;
  canManage?: boolean;
  onClose: () => void;
  onEdit?: (supply: SupplyItem) => void;
  onStockAction?: (supply: SupplyItem, type: "in" | "out") => void;
  onViewDocuments?: (supply: SupplyItem) => void;
  onLightboxImage?: (url: string) => void;
}

export const SupplyDetailModal: React.FC<Props> = ({
  isOpen,
  supply,
  activeBranchId,
  canManage = false,
  onClose,
  onEdit,
  onStockAction,
  onViewDocuments,
  onLightboxImage,
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "documents">("overview");
  const [transactions, setTransactions] = useState<SupplyTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && supply) {
      setActiveTab("overview");
      setLoadingHistory(true);
      supplyService
        .getTransactions(supply._id, activeBranchId)
        .then((res) => setTransactions(res || []))
        .catch(() => setTransactions([]))
        .finally(() => setLoadingHistory(false));
    }
  }, [isOpen, supply, activeBranchId]);

  if (!isOpen || !supply) return null;

  // Status calculation
  const getExpiryBadge = () => {
    if (!supply.expiryDate)
      return (
        <span className="text-xs text-amber-700">
          {supply.requiresExpiry === false ? "Không áp dụng hạn dùng" : "Chưa xác minh hạn dùng — không được xuất dùng"}
        </span>
      );
    const exp = new Date(supply.expiryDate);
    const now = new Date(supplyBusinessDay() + "T00:00:00Z");
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          Đã hết hạn ({exp.toLocaleDateString("vi-VN")})
        </span>
      );
    }
    if (diffDays <= 30) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          Hết hạn sau {diffDays} ngày ({exp.toLocaleDateString("vi-VN")})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        Hạn dùng: {exp.toLocaleDateString("vi-VN")}
      </span>
    );
  };

  const getStockBadge = () => {
    if (supply.quantity <= 0) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          Hết hàng trong kho
        </span>
      );
    }
    if (supply.quantity <= supply.minQuantity) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
          Cảnh báo: Tồn dưới định mức ({supply.minQuantity} {supply.unit})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        Đầy đủ định mức tồn
      </span>
    );
  };

  const totalValue = (supply.quantity || 0) * (supply.unitPrice || 0);

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 md:p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
          <div className="flex items-start gap-4">
            {supply.imageUrl ? (
              <img
                src={supply.imageUrl}
                alt={supply.name}
                onClick={() => onLightboxImage && onLightboxImage(supply.imageUrl!)}
                className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shrink-0 cursor-pointer hover:opacity-90 shadow-xs"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 text-white shadow-md shadow-emerald-500/20">
                <Package className="w-8 h-8" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900">{supply.name}</h2>
                <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-mono text-xs font-bold">
                  {supply.code}
                </span>
                {supply.category && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {supply.category}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {getStockBadge()}
                {getExpiryBadge()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canManage && onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(supply);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition shadow-2xs"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                Chỉnh sửa
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Highlights Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 md:px-6 bg-slate-50/80 border-b border-slate-100">
          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs">
            <span className="text-xs text-slate-400 block font-medium">Tồn kho hiện tại</span>
            <div className="text-lg font-bold text-slate-900 mt-0.5">
              {supply.quantity} <span className="text-xs font-normal text-slate-500">{supply.unit}</span>
            </div>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              Mức tối thiểu: {supply.minQuantity} {supply.unit}
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs">
            <span className="text-xs text-slate-400 block font-medium">Đơn giá vốn</span>
            <div className="text-lg font-bold text-slate-900 mt-0.5">
              {supply.unitPrice ? supply.unitPrice.toLocaleString("vi-VN") : "0"}{" "}
              <span className="text-xs font-normal text-slate-500">đ</span>
            </div>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              Tổng trị giá: {totalValue.toLocaleString("vi-VN")} đ
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs">
            <span className="text-xs text-slate-400 block font-medium">Số lô & Hạn dùng</span>
            <div className="text-sm font-bold text-slate-900 mt-0.5 truncate">
              {supply.batchNumber ? `Lô ${supply.batchNumber}` : "Chưa có lô"}
            </div>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              HSD: {supply.expiryDate ? new Date(supply.expiryDate).toLocaleDateString("vi-VN") : "—"}
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs">
            <span className="text-xs text-slate-400 block font-medium">Vị trí lưu kho</span>
            <div className="text-sm font-bold text-slate-900 mt-0.5 truncate">
              {supply.warehouseLocation || "Chưa gán kho"}
            </div>
            <span className="text-[11px] text-slate-500 block mt-0.5 truncate">
              Phòng: {supply.roomId || "Toàn viện"}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 px-6 bg-white">
          <button
            onClick={() => setActiveTab("overview")}
            className={`py-3 px-4 text-sm font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === "overview"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Boxes className="w-4 h-4" />
            Thông tin chi tiết
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-3 px-4 text-sm font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === "history"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <History className="w-4 h-4" />
            Lịch sử Xuất / Nhập
            {transactions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                {transactions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`py-3 px-4 text-sm font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === "documents"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText className="w-4 h-4" />
            Tài liệu & Chứng chỉ
            {supply.documents && supply.documents.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                {supply.documents.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 text-sm">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Detailed Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Panel 1: Thông tin sản xuất & Kiểm định */}
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Sản xuất & Kiểm định
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-200/50">
                      <span className="text-slate-500">Ngày sản xuất (NSX):</span>
                      <span className="font-semibold text-slate-800">
                        {supply.manufactureDate
                          ? new Date(supply.manufactureDate).toLocaleDateString("vi-VN")
                          : "Chưa có"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/50">
                      <span className="text-slate-500">Hạn sử dụng (HSD):</span>
                      <span className="font-semibold text-slate-800">
                        {supply.expiryDate ? new Date(supply.expiryDate).toLocaleDateString("vi-VN") : "Chưa có"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/50">
                      <span className="text-slate-500">Số lô sản xuất:</span>
                      <span className="font-mono font-semibold text-slate-800">{supply.batchNumber || "—"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/50">
                      <span className="text-slate-500">Ngày kiểm định gần nhất:</span>
                      <span className="font-semibold text-slate-800">
                        {supply.inspectionDate
                          ? new Date(supply.inspectionDate).toLocaleDateString("vi-VN")
                          : "Chưa kiểm định"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/50">
                      <span className="text-slate-500">Ngày kiểm định tiếp theo:</span>
                      <span className="font-semibold text-slate-800">
                        {supply.nextInspectionDate
                          ? new Date(supply.nextInspectionDate).toLocaleDateString("vi-VN")
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Mã / Số chứng chỉ kiểm định:</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {supply.inspectionCertificateNumber || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Panel 2: Lưu kho & Cung ứng */}
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    Lưu trữ & Cung ứng
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-200/50">
                      <span className="text-slate-500">Kho lưu trữ:</span>
                      <span className="font-semibold text-slate-800">
                        {supply.warehouseLocation || "Chưa thiết lập"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/50">
                      <span className="text-slate-500">Khoa / Phòng sử dụng:</span>
                      <span className="font-semibold text-slate-800">{supply.roomId || "Toàn viện"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/50">
                      <span className="text-slate-500">Nhà cung cấp:</span>
                      <span className="font-semibold text-slate-800">{supply.supplier || "Chưa phân bổ"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/50">
                      <span className="text-slate-500">Quy cách đóng gói:</span>
                      <span className="font-semibold text-slate-800">{supply.unit}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Ngày tạo hồ sơ:</span>
                      <span className="text-slate-600">
                        {supply.createdAt ? new Date(supply.createdAt).toLocaleString("vi-VN") : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes / Ghi chú */}
              {supply.notes && (
                <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100 text-xs">
                  <span className="font-bold text-amber-900 block mb-1">Ghi chú & Hướng dẫn bảo quản:</span>
                  <p className="text-amber-800 whitespace-pre-wrap">{supply.notes}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div>
              {loadingHistory ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                  Đang tải lịch sử giao dịch...
                </div>
              ) : transactions.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <History className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  Chưa có giao dịch xuất / nhập nào được ghi nhận cho vật tư này.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {transactions.map((tx) => (
                    <div key={tx._id} className="py-3 flex items-start justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {tx.type === "in" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs">
                              <ArrowDownRight className="w-3.5 h-3.5" />
                              Nhập kho: +{tx.quantity} {supply.unit}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-700 font-bold text-xs">
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              Xuất dùng: -{tx.quantity} {supply.unit}
                            </span>
                          )}
                          {tx.batchCode && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[10px] font-bold">
                              {tx.batchCode}
                            </span>
                          )}
                          <span className="text-slate-400">{new Date(tx.createdAt).toLocaleString("vi-VN")}</span>
                        </div>
                        <p className="text-slate-700 mt-1.5 font-medium">
                          {tx.type === "out" && tx.recipientDepartment && (
                            <span className="font-bold text-slate-900 mr-2 bg-slate-100 px-1.5 py-0.5 rounded">
                              Khoa nhận: {tx.recipientDepartment}
                            </span>
                          )}
                          Lý do: {tx.reason || "Không ghi chú"}
                        </p>
                        <p className="text-slate-400 text-[11px] mt-0.5">
                          Thực hiện: <span className="text-slate-600 font-medium">{tx.performerName}</span> · Tồn sau
                          GD:{" "}
                          <span className="font-semibold text-slate-800">
                            {tx.balanceAfter} {supply.unit}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "documents" && (
            <div>
              {supply.documents && supply.documents.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      Danh sách tài liệu, hồ sơ kiểm định và chứng chỉ nguồn gốc (CO/CQ):
                    </p>
                    {onViewDocuments && (
                      <button
                        onClick={() => {
                          onClose();
                          onViewDocuments(supply);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Mở bộ xem tài liệu toàn màn hình
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {supply.documents.map((doc, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border border-slate-200/80 bg-white hover:border-blue-300 transition flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs uppercase">
                            {doc.name.split(".").pop() || "FILE"}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 text-xs truncate" title={doc.name}>
                              {doc.name}
                            </p>
                            <span className="text-[11px] text-slate-400">
                              {new Date(doc.uploadedAt).toLocaleDateString("vi-VN")}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {onViewDocuments && (
                            <button
                              onClick={() => {
                                onClose();
                                onViewDocuments(supply);
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Xem tài liệu"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <a
                            href={doc.fileUrl || (doc as any).url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
                            title="Tải về"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <FileCheck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  Chưa có tài liệu hoặc chứng chỉ nào được đính kèm cho vật tư này.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 md:px-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {canManage && onStockAction && (
              <>
                <button
                  onClick={() => {
                    onClose();
                    onStockAction(supply, "in");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition"
                >
                  <ArrowDownRight className="w-4 h-4" />
                  Nhập kho
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onStockAction(supply, "out");
                  }}
                  disabled={!canIssueSupply(supply)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 disabled:opacity-40 text-xs font-semibold transition"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Xuất kho
                </button>
              </>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
