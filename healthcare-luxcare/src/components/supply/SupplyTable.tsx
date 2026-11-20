import { supplyBusinessDay } from "../../../shared/supply-stock";
import React from "react";
import {
  Package,
  MapPin,
  Building2,
  ShieldCheck,
  FileCheck,
  Edit2,
  Trash2,
  Eye,
  Loader2,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from "lucide-react";
import type { SupplyItem } from "../../types/supply";
import { LogisticsEmptyIllustration } from "../common/LogisticsEmptyIllustration";

interface Props {
  items: SupplyItem[];
  loading: boolean;
  canManage: boolean;
  page: number;
  limit: number;
  total: number;
  setPage: (page: number) => void;
  onOpenStock?: (item: SupplyItem, type: "in" | "out") => void;
  onOpenHistory?: (item: SupplyItem) => void;
  onOpenEdit: (item: SupplyItem) => void;
  onDelete: (id: string, name: string) => void;
  onViewDocs: (item: SupplyItem) => void;
  onViewDetail?: (item: SupplyItem) => void;
  onLightboxImage: (url: string) => void;
}

export const SupplyTable: React.FC<Props> = ({
  items,
  loading,
  canManage,
  page,
  limit,
  total,
  setPage,
  onOpenStock,
  onOpenHistory,
  onOpenEdit,
  onDelete,
  onViewDocs,
  onViewDetail,
  onLightboxImage,
}) => {
  const totalPages = Math.ceil(total / limit) || 1;

  const getExpiryBadge = (expiryDateStr: string | null, requiresExpiry = true) => {
    if (!expiryDateStr)
      return (
        <span className="text-xs text-amber-700">
          {requiresExpiry ? "Chưa xác minh hạn dùng" : "Không áp dụng hạn dùng"}
        </span>
      );
    const exp = new Date(expiryDateStr);
    const now = new Date(supplyBusinessDay() + "T00:00:00Z");
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          Đã hết hạn ({new Date(expiryDateStr).toLocaleDateString("vi-VN")})
        </span>
      );
    }
    if (diffDays <= 30) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" />
          Còn {diffDays} ngày ({new Date(expiryDateStr).toLocaleDateString("vi-VN")})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-100">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
        {new Date(expiryDateStr).toLocaleDateString("vi-VN")}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-sm">Đang tải dữ liệu vật tư tiêu hao...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-on-surface-variant">
        <LogisticsEmptyIllustration kind="supplies" />
        <p className="text-lg font-medium text-slate-600">Không tìm thấy vật tư nào</p>
        <p className="text-sm mt-1">Hãy điều chỉnh bộ lọc hoặc thêm vật tư mới vào hệ thống.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase border-b border-slate-100">
              <th className="p-4 pl-6">Ảnh & Tên vật tư</th>
              <th className="p-4">Tồn kho / ĐVT</th>
              <th className="p-4 text-right whitespace-nowrap">Thành tiền</th>
              <th className="p-4">Hạn sử dụng & Lô</th>
              <th className="p-4">Vị trí lưu kho</th>
              <th className="p-4">Kiểm định & Nhà CC</th>
              <th className="p-4 text-center">Tài liệu</th>
              <th className="p-4 pr-6 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
            {items.map((item) => (
              <tr key={item._id} className="hover:bg-slate-50/60 transition">
                {/* Ảnh & Tên */}
                <td className="p-4 pl-6">
                  <div className="flex items-center gap-3">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        onClick={() => onLightboxImage(item.imageUrl || "")}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 cursor-pointer hover:scale-105 transition"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-600 font-bold">
                        <Package className="w-6 h-6 text-emerald-500" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p
                        onClick={() => onViewDetail && onViewDetail(item)}
                        className="font-semibold text-slate-900 line-clamp-1 hover:text-emerald-600 cursor-pointer transition"
                        title="Bấm để xem chi tiết vật tư"
                      >
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400 font-mono">{item.code}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                          {item.category}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>

                {/* Tồn kho & ĐVT */}
                <td className="p-4">
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`text-base font-bold ${
                        item.quantity <= 0
                          ? "text-rose-600"
                          : item.quantity <= item.minQuantity
                            ? "text-amber-600"
                            : "text-emerald-700"
                      }`}
                    >
                      {item.quantity.toLocaleString("vi-VN")}
                    </span>
                    <span className="text-xs text-slate-500">{item.unit}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Mức tối thiểu: {item.minQuantity} {item.unit}
                  </p>
                </td>

                <td className="p-4 text-right whitespace-nowrap tabular-nums">
                  <p className="font-semibold text-emerald-700">
                    {(item.quantity * (item.unitPrice ?? 0)).toLocaleString("vi-VN")} ₫
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {item.unitPrice == null
                      ? "Chưa có đơn giá"
                      : `Đơn giá: ${item.unitPrice.toLocaleString("vi-VN")} ₫/${item.unit}`}
                  </p>
                </td>

                {/* Hạn sử dụng & Lô */}
                <td className="p-4">
                  {getExpiryBadge(item.expiryDate, item.requiresExpiry !== false)}
                  {item.batchNumber && (
                    <p className="text-xs text-slate-500 mt-1 font-mono">
                      Lô: <span className="font-semibold text-slate-700">{item.batchNumber}</span>
                    </p>
                  )}
                </td>

                {/* Vị trí kho */}
                <td className="p-4">
                  <div className="flex items-start gap-1 text-slate-700">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="font-medium text-xs leading-relaxed">{item.warehouseLocation}</span>
                  </div>
                </td>

                {/* Kiểm định & Nhà CC */}
                <td className="p-4">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-700 font-medium line-clamp-1">
                      <Building2 className="w-3 h-3 text-slate-400 inline mr-1" />
                      {item.supplier}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      <ShieldCheck className="w-3 h-3 text-emerald-600 inline mr-1" />
                      KĐ: {new Date(item.inspectionDate).toLocaleDateString("vi-VN")}
                      {item.inspectionCertificateNumber && (
                        <span className="font-mono text-slate-400 ml-1">({item.inspectionCertificateNumber})</span>
                      )}
                    </p>
                  </div>
                </td>

                {/* Tài liệu đính kèm */}
                <td className="p-4 text-center">
                  {item.documents && item.documents.length > 0 ? (
                    <button
                      onClick={() => onViewDocs(item)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition cursor-pointer"
                    >
                      <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                      {item.documents.length} tệp
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>

                {/* Thao tác */}
                <td className="p-4 pr-6 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {onViewDetail && (
                      <button
                        onClick={() => onViewDetail(item)}
                        className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 transition cursor-pointer"
                        title="Xem chi tiết vật tư"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    {canManage ? (
                      <>
                        <button
                          disabled={item.isActive === false}
                          onClick={() => onOpenEdit(item)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition cursor-pointer"
                          title="Chỉnh sửa vật tư"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(item._id, item.name)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title={item.isActive === false ? "Khôi phục vật tư" : "Ngừng sử dụng vật tư"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      !onViewDetail && <span className="text-xs text-slate-400 italic">Chỉ xem</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between">
        <span className="text-sm text-slate-500">
          Hiển thị <span className="font-semibold text-slate-700">{items.length}</span> trên{" "}
          <span className="font-semibold text-slate-700">{total}</span> vật tư
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(Math.max(page - 1, 1))}
            disabled={page === 1}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-sm font-medium rounded-xl transition cursor-pointer"
          >
            Trước
          </button>
          <span className="px-3 text-sm font-medium text-slate-600">
            Trang {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(page + 1, totalPages))}
            disabled={page === totalPages}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-sm font-medium rounded-xl transition cursor-pointer"
          >
            Sau
          </button>
        </div>
      </div>
    </>
  );
};
