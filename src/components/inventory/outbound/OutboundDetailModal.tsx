import React, { useState, useMemo } from "react";
import { toast } from "../../../pages/Toast";
import { OutboundReversalControl } from "./OutboundReversalControl";
import type { Warehouse } from "../../../services/inventoryReceivingService";
import {
  printOutboundVoucher,
  purposeLabel,
  type OutboundTicket,
} from "./printOutboundVoucher";

export interface OutboundDetailModalProps {
  onReverse?: (id: string, reason: string) => Promise<{ _id: string }>;
  ticket: OutboundTicket;
  onClose: () => void;
  warehouses: Warehouse[];
  onUpdateStatus?: (
    ticketId: string,
    status: "Đang chờ" | "Đang xử lý" | "Hoàn thành"
  ) => Promise<void>;
  onEdit?: (ticket: OutboundTicket) => void;
}

export function OutboundDetailModal({
  onReverse,
  ticket,
  onClose,
  warehouses,
  onUpdateStatus,
  onEdit,
}: OutboundDetailModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [includeImeisInPrint, setIncludeImeisInPrint] = useState(true);
  const [searchImeiQuery, setSearchImeiQuery] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Tìm kho xuất
  const warehouse = useMemo(() => {
    return warehouses.find((w) => w._id === ticket.warehouseId);
  }, [warehouses, ticket.warehouseId]);

  // Tổng số lượng máy
  const totalQuantity = useMemo(() => {
    return ticket.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, [ticket.items]);

  // Gom toàn bộ IMEI để hỗ trợ sao chép toàn bộ
  const allSerials = useMemo(() => {
    const list: Array<{ sku: string; productName: string; serial: string }> = [];
    ticket.items.forEach((item) => {
      const serials = (item.serialNumbers || item.unitIdentifiers || []).filter(Boolean);
      serials.forEach((sn) => {
        list.push({
          sku: item.sku,
          productName: item.productName,
          serial: sn.trim(),
        });
      });
    });
    return list;
  }, [ticket.items]);

  const copyToClipboard = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Đã sao chép ${label}!`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const copyAllImeis = () => {
    if (allSerials.length === 0) {
      toast.error("Phiếu này không có mã IMEI nào để sao chép.");
      return;
    }
    const text = allSerials.map((s) => s.serial).join("\n");
    copyToClipboard(text, "all-imeis", `toàn bộ ${allSerials.length} IMEI`);
  };

  const handlePrint = () => {
    printOutboundVoucher({
      ticket,
      warehouse,
      includeSerials: includeImeisInPrint,
    });
  };

  const handleStatusChange = async (nextStatus: "Đang chờ" | "Đang xử lý" | "Hoàn thành") => {
    if (!onUpdateStatus) return;
    setUpdatingStatus(true);
    try {
      await onUpdateStatus(ticket.id, nextStatus);
      toast.success(`Đã cập nhật trạng thái phiếu thành "${nextStatus}".`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Không thể cập nhật trạng thái phiếu.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const currentStatus = ticket.status || "Đang chờ";

  const statusBadgeClass =
    currentStatus === "Hoàn thành"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : currentStatus === "Đang xử lý"
      ? "bg-orange-50 text-orange-700 border-orange-200"
      : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50/90 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">
                {ticket.title || "Chi tiết phiếu xuất kho"}
              </h3>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusBadgeClass}`}>
                {ticket.reversalId ? "Đã đảo toàn bộ" : currentStatus}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Mã chứng từ: <span className="font-mono font-semibold text-slate-700">{ticket.id}</span>
              {" · "}Ngày tạo: {new Date(ticket.createdAt).toLocaleString("vi-VN")}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {currentStatus === "Đang chờ" && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onEdit(ticket);
                  onClose();
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Sửa phiếu
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>

        {/* Info Grid */}
        <div className="border-b border-slate-200 bg-white p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Kho xuất hàng
              </span>
              <div className="mt-1 text-sm font-bold text-slate-800">
                {warehouse?.name || "Kho mặc định"}
              </div>
              <div className="mt-0.5 font-mono text-xs text-slate-500">
                Mã: {warehouse?.code || "DEFAULT"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Mục đích xuất
              </span>
              <div className="mt-1 text-sm font-bold text-slate-800">
                {purposeLabel(ticket.purpose)}
              </div>
              <div className="mt-0.5 text-xs text-slate-500 truncate">
                {ticket.purpose === "chuyển kho"
                  ? "Luân chuyển nội bộ cơ sở"
                  : ticket.purpose === "nội bộ"
                  ? "Cấp phát nhân sự / kỹ thuật"
                  : "Trả bảo hành hoặc thanh lý"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {ticket.purpose === "chuyển kho" ? "Kho / Chi nhánh nhận" : ticket.purpose === "nội bộ" ? "Nhân viên / Phòng ban nhận" : "Lý do / Đơn vị nhận"}
              </span>
              <div className="mt-1 text-sm font-bold text-slate-800 truncate">
                {ticket.customerName || "Khách lẻ / Khách vãng lai"}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {ticket.customerId ? `Mã KH: ${ticket.customerId}` : "Không có mã KH"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Người phụ trách
              </span>
              <div className="mt-1 text-sm font-bold text-slate-800">
                {ticket.operatorName || "Thủ kho"}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                Bộ phận Quản trị Kho
              </div>
            </div>
          </div>

          {ticket.notes && (
            <div className="mt-3 rounded-lg bg-amber-50/60 border border-amber-200/60 px-3.5 py-2 text-xs text-amber-900">
              <strong>Ghi chú:</strong> {ticket.notes}
            </div>
          )}
        </div>

        {/* Table of items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-800">
              Danh sách sản phẩm xuất kho ({ticket.items.length} mặt hàng · {totalQuantity} máy)
            </h4>

            {allSerials.length > 0 && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={searchImeiQuery}
                  onChange={(e) => setSearchImeiQuery(e.target.value)}
                  placeholder="Tra nhanh IMEI trong phiếu..."
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:border-cyan-600 focus:bg-white focus:outline-none w-56"
                />
                <button
                  type="button"
                  onClick={copyAllImeis}
                  className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 transition-colors"
                >
                  {copiedKey === "all-imeis" ? "Đã sao chép!" : `Sao chép ${allSerials.length} IMEI`}
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 w-12 text-center">STT</th>
                  <th className="px-4 py-3">Sản phẩm / Biến thể</th>
                  <th className="px-4 py-3 w-36">Mã SKU</th>
                  <th className="px-4 py-3 text-right w-24">Số lượng</th>
                  <th className="px-4 py-3">Danh sách IMEI / Serial xuất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ticket.items.map((item, idx) => {
                  const serials = (item.serialNumbers || item.unitIdentifiers || []).filter(Boolean);
                  const searchNormalized = searchImeiQuery.trim().toLowerCase();

                  return (
                    <tr key={`${item.sku}-${idx}`} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3.5 text-center text-xs font-medium text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">{item.productName}</div>
                        {item.displayName && item.displayName !== item.productName && (
                          <div className="text-xs text-cyan-700 font-medium mt-0.5">
                            {item.displayName}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-600">
                        {item.sku}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-rose-600 tabular-nums">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3.5">
                        {serials.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                            {serials.map((sn, sIdx) => {
                              const isMatched =
                                searchNormalized && sn.toLowerCase().includes(searchNormalized);
                              const isCopied = copiedKey === `sn-${idx}-${sIdx}`;

                              return (
                                <button
                                  key={sIdx}
                                  type="button"
                                  onClick={() =>
                                    copyToClipboard(sn, `sn-${idx}-${sIdx}`, `IMEI ${sn}`)
                                  }
                                  title="Bấm để sao chép IMEI này"
                                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] transition-colors border ${
                                    isMatched
                                      ? "bg-amber-100 border-amber-300 text-amber-900 font-bold"
                                      : isCopied
                                      ? "bg-emerald-100 border-emerald-300 text-emerald-900 font-bold"
                                      : "bg-slate-50 border-slate-200 text-slate-700 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-900"
                                  }`}
                                >
                                  <span>{sn}</span>
                                  {isCopied && <span className="text-[9px] text-emerald-700">✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            Hàng quản lý theo số lượng (không có IMEI)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer & Actions */}
        <div className="border-t border-slate-200 px-6 py-3"><OutboundReversalControl key={ticket.id} ticket={ticket} onReverse={onReverse} /></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            {allSerials.length > 0 && (
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeImeisInPrint}
                  onChange={(e) => setIncludeImeisInPrint(e.target.checked)}
                  className="rounded border-slate-300 text-cyan-700 focus:ring-cyan-600 h-3.5 w-3.5"
                />
                In kèm danh sách IMEI chi tiết
              </label>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-lg bg-cyan-700 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-800 transition-colors shadow-xs"
            >
              In phiếu xuất kho
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onUpdateStatus && currentStatus === "Đang chờ" && (
              <button
                type="button"
                disabled={updatingStatus}
                onClick={() => handleStatusChange("Đang xử lý")}
                className="rounded-lg border border-orange-300 bg-orange-50 px-3.5 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-100 transition-colors disabled:opacity-50"
              >
                Chuyển sang "Đang xử lý"
              </button>
            )}

            {onUpdateStatus && currentStatus === "Đang xử lý" && (
              <button
                type="button"
                disabled={updatingStatus}
                onClick={() => handleStatusChange("Hoàn thành")}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors shadow-xs disabled:opacity-50"
              >
                Hoàn thành xuất kho
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-800 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-900 transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
