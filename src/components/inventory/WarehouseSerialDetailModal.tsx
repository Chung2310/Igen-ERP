import React, { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { toast } from "../../pages/Toast";
import {
  inventorySerialService,
  type InventorySerialUnit,
} from "../../services/inventorySerialService";
import type { InventoryBalance } from "../../services/inventoryReceivingService";
import { printDeviceBarcodeLabels } from "./receiving/printDeviceBarcodeLabels";

type Props = {
  balance: InventoryBalance;
  onClose: () => void;
};

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa cập nhật";

export function WarehouseSerialDetailModal({ balance, onClose }: Props) {
  const [items, setItems] = useState<InventorySerialUnit[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    inventorySerialService
      .list({
        warehouseId: balance.warehouseId,
        productId: balance.productId,
        variantId: balance.variantId,
        sku: balance.sku,
        trackingMode: balance.trackingMode === "unit_barcode" ? "unit_barcode" : "serial",
        status: "in_stock",
        limit: 200,
      })
      .then((result) => {
        if (active) setItems(result.items || []);
      })
      .catch((cause) => {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : "Không thể tải danh sách IMEI/serial"
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [balance.warehouseId, balance.productId, balance.variantId, balance.sku]);

  // Filter items by query
  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      [item.serialNumber, item.internalBarcode, item.imei1, item.imei2].some((code) =>
        String(code || "").toLowerCase().includes(term)
      )
    );
  }, [items, query]);

  // Copy helper
  const copyText = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Đã sao chép ${label}!`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Copy all device identifiers in this modal
  const handleCopyAll = () => {
    const imeis = filteredItems
      .map((item) => [item.sku, item.internalBarcode, item.serialNumber, item.imei1, item.imei2].filter(Boolean).join("\t"))
      .filter(Boolean);

    if (imeis.length === 0) {
      toast.info("Không có thông tin thiết bị để sao chép.");
      return;
    }

    navigator.clipboard.writeText(imeis.join("\n"));
    setCopiedKey("all");
    toast.success(`Đã sao chép ${imeis.length} máy vào bộ nhớ tạm!`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handlePrintLabels = () => {
    try {
      printDeviceBarcodeLabels(filteredItems.filter((item) => item.internalBarcode).map((item) => ({
        internalBarcode: item.internalBarcode,
        sku: item.sku,
        productName: item.productName,
        serialNumber: item.serialNumber === item.internalBarcode ? undefined : item.serialNumber,
        imei1: item.imei1,
        imei2: item.imei2,
      })));
    } catch (cause: unknown) {
      toast.error(cause instanceof Error ? cause.message : "Không thể mở trang in tem mã vạch.");
    }
  };

  const availableCount = Math.max(0, balance.quantity - balance.reservedQuantity);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="serial-modal-title"
        className="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 id="serial-modal-title" className="text-base font-bold text-slate-900 tracking-tight">
                Danh sách máy tồn kho
              </h2>
              <span className="font-mono text-xs font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                {balance.sku}
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-600 font-medium">
              <span className="text-slate-900 font-bold">{balance.productName || "Sản phẩm"}</span>
              {balance.variantName && (
                <span className="text-cyan-800 font-semibold"> · {balance.variantName}</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {filteredItems.some((item) => item.internalBarcode) && (
              <button
                type="button"
                onClick={handlePrintLabels}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-700 bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-800 transition-colors whitespace-nowrap"
              >
                <Printer className="h-3.5 w-3.5" /> In tem
              </button>
            )}
            {filteredItems.length > 0 && (
              <button
                type="button"
                onClick={handleCopyAll}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs whitespace-nowrap"
              >
                {copiedKey === "all" ? "Đã chép tất cả" : `Sao chép ${filteredItems.length} máy`}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="rounded-md p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-sm font-bold leading-none ml-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filter & Metric Strip */}
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo số IMEI, serial hoặc mã vạch nội bộ..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 transition-all font-medium"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
            <span>
              Tồn kho: <strong className="text-slate-900">{balance.quantity} máy</strong>
            </span>
            <span>·</span>
            <span>
              Khả dụng: <strong className="text-emerald-700">{availableCount} máy</strong>
            </span>
            <span>·</span>
            <span>
              Hiển thị: <strong className="text-cyan-800">{filteredItems.length} máy</strong>
            </span>
          </div>
        </div>

        {/* Body Table Container */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="py-16 text-center text-xs font-medium text-slate-500">
              Đang tải danh sách IMEI / serial tồn kho...
            </div>
          )}

          {!loading && error && (
            <div className="py-12 text-center text-xs font-semibold text-rose-600">
              {error}
            </div>
          )}

          {!loading && !error && filteredItems.length === 0 && (
            <div className="py-16 text-center text-xs text-slate-500">
              <p className="font-semibold text-slate-700">
                {query ? "Không tìm thấy IMEI nào khớp với từ khóa tìm kiếm." : "SKU này hiện chưa có mã IMEI nào trong kho."}
              </p>
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="mt-2 text-xs font-semibold text-cyan-700 hover:underline"
                >
                  Xóa bộ lọc tìm kiếm
                </button>
              )}
            </div>
          )}

          {!loading && !error && filteredItems.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="w-12 px-3 py-3 text-center">#</th>
                    <th className="w-48 px-4 py-3">Serial / IMEI chính</th>
                    <th className="px-4 py-3">Mã vạch nội bộ</th>
                    <th className="px-4 py-3">IMEI 1 / IMEI 2</th>
                    <th className="w-40 px-4 py-3 text-center">Bảo hành NCC đến</th>
                    <th className="w-28 px-4 py-3 text-center whitespace-nowrap">Trạng thái</th>
                    <th className="w-20 px-3 py-3 text-center whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item, index) => {
                    const serialLabel = item.serialNumber === item.internalBarcode ? "" : item.serialNumber;
                    const deviceText = [serialLabel, item.imei1, item.imei2, item.internalBarcode].filter(Boolean).join("\t");
                    const isCopied = copiedKey === `device-${index}`;

                    return (
                      <tr
                        key={item._id || index}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        {/* STT */}
                        <td className="px-3 py-2.5 text-center font-medium text-slate-400">
                          {index + 1}
                        </td>

                        {/* IMEI / Serial */}
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() => deviceText && copyText(deviceText, `device-${index}`, "thông tin thiết bị")}
                            className="font-mono text-xs font-bold text-slate-900 hover:text-cyan-700 transition-colors text-left"
                            title="Bấm để sao chép thông tin thiết bị"
                          >
                            {serialLabel || "—"}
                          </button>
                        </td>

                        {/* Internal Barcode */}
                        <td className="px-4 py-2.5">
                          <span
                            className="font-mono text-[11px] text-slate-600 select-all"
                            title={item.internalBarcode}
                          >
                            {item.internalBarcode || "—"}
                          </span>
                        </td>

                        <td className="px-4 py-2.5 font-mono text-[10px] text-slate-600">
                          <span>{item.imei1 || "—"}</span>
                          {item.imei2 && <span className="block">{item.imei2}</span>}
                        </td>

                        {/* Warranty */}
                        <td className="px-4 py-2.5 text-center text-slate-600">
                          {formatDate(item.supplierWarranty?.endAt)}
                        </td>

                        {/* Status (Guaranteed whitespace-nowrap, never broken into 2 lines) */}
                        <td className="px-4 py-2.5 text-center whitespace-nowrap">
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200 whitespace-nowrap">
                            Còn tồn
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => deviceText && copyText(deviceText, `device-${index}`, "thông tin thiết bị")}
                            className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-cyan-800 transition-colors shadow-2xs"
                          >
                            {isCopied ? "Đã chép" : "Chép"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3">
          <span className="text-xs text-slate-500">
            Tổng cộng: <strong className="text-slate-900">{filteredItems.length} mã máy</strong> tồn kho thực tế
          </span>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
