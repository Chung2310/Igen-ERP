import React, { useMemo, useState, useEffect } from "react";
import { Printer } from "lucide-react";
import { toast } from "../../../pages/Toast";
import type { GoodsReceipt, Supplier, Warehouse } from "../../../services/inventoryReceivingService";
import { inventoryReceivingService } from "../../../services/inventoryReceivingService";
import { productCatalogService, type CatalogProductDetail } from "../../../services/productCatalogService";
import { printReceiptVoucher } from "./printReceiptVoucher";
import { printDeviceBarcodeLabels, type DeviceBarcodeLabel } from "./printDeviceBarcodeLabels";

interface ReceiptDetailModalProps {
  receipt: GoodsReceipt;
  onClose: () => void;
  suppliers?: Supplier[];
  warehouses?: Warehouse[];
}

const trackingLabels: Record<string, string> = {
  serial: "IMEI / Serial",
  unit_barcode: "Mã vạch đơn vị",
  quantity: "Số lượng",
  lot: "Theo lô",
  none: "Không theo dõi",
};

export function ReceiptDetailModal({
  receipt,
  onClose,
  suppliers: propSuppliers,
  warehouses: propWarehouses,
}: ReceiptDetailModalProps) {
  const [expandedImeiIndex, setExpandedImeiIndex] = useState<Record<number, boolean>>({ 0: true });
  const [searchImeiQuery, setSearchImeiQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [includeImeisInPrint, setIncludeImeisInPrint] = useState(true);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(propWarehouses || []);
  const [suppliers, setSuppliers] = useState<Supplier[]>(propSuppliers || []);
  const [productDetails, setProductDetails] = useState<Record<string, CatalogProductDetail>>({});

  // Load warehouses & suppliers if not provided
  useEffect(() => {
    if (!propWarehouses || propWarehouses.length === 0) {
      inventoryReceivingService.listWarehouses().then(setWarehouses).catch(() => undefined);
    }
    if (!propSuppliers || propSuppliers.length === 0) {
      inventoryReceivingService.listSuppliers().then(setSuppliers).catch(() => undefined);
    }
  }, [propWarehouses, propSuppliers]);

  // Load product details for missing displayNames
  useEffect(() => {
    const productIds = Array.from(new Set(receipt.items.map((i) => i.productId).filter(Boolean)));
    for (const pid of productIds) {
      if (!productDetails[pid]) {
        productCatalogService.getProduct(pid).then((detail) => {
          if (detail) {
            setProductDetails((curr) => ({ ...curr, [pid]: detail }));
          }
        }).catch(() => undefined);
      }
    }
  }, [receipt.items]);

  const supplier = useMemo(() => {
    return suppliers.find((s) => s._id === receipt.supplierId || s.name === receipt.supplierName);
  }, [suppliers, receipt]);

  const warehouse = useMemo(() => {
    return warehouses.find((w) => w._id === receipt.warehouseId);
  }, [warehouses, receipt]);

  // Total metrics
  const totalQuantity = useMemo(() => {
    return receipt.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, [receipt.items]);

  const allSerialsList = useMemo(() => {
    const list: Array<DeviceBarcodeLabel> = [];
    receipt.items.forEach((item) => {
      const serials = item.serialNumbers || [];
      const details = item.unitDetails || [];
      const count = Math.max(serials.length, details.length);
      for (let idx = 0; idx < count; idx += 1) {
        const unit = details[idx] || {};
        const label = {
          sku: item.sku,
          productName: item.productName,
          internalBarcode: unit.internalBarcode || "",
          serialNumber: unit.serialNumber || serials[idx] || undefined,
          imei1: unit.imei1,
          imei2: unit.imei2,
        };
        if (label.internalBarcode || label.serialNumber || label.imei1 || label.imei2) list.push(label);
      }
    });
    return list;
  }, [receipt.items]);

  const handlePrintUnitLabels = () => {
    try {
      printDeviceBarcodeLabels(allSerialsList.filter((unit) => unit.internalBarcode));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Không thể mở trang in tem mã vạch.");
    }
  };

  // Copy helper
  const copyToClipboard = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Đã sao chép ${label}!`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Copy all IMEIs in this receipt
  const handleCopyAllImeis = () => {
    if (allSerialsList.length === 0) {
      toast.info("Phiếu nhập này chưa có thông tin thiết bị.");
      return;
    }
    const content = allSerialsList.map((unit) => [unit.sku, unit.internalBarcode, unit.serialNumber, unit.imei1, unit.imei2].filter(Boolean).join("\t")).join("\n");
    copyToClipboard(content, "all-imeis", `${allSerialsList.length} dòng thiết bị`);
  };

  // Print receipt via isolated iframe
  const handlePrint = () => {
    printReceiptVoucher({
      receipt,
      supplier,
      warehouse,
      productDetails,
      includeSerials: includeImeisInPrint,
    });
  };

  // Status mapping
  const statusDetails: Record<GoodsReceipt["status"], { label: string; className: string }> = {
    draft: { label: "Bản nháp", className: "bg-slate-100 text-slate-700 border-slate-200" },
    pending: { label: "Chờ xác nhận", className: "bg-amber-50 text-amber-700 border-amber-200" },
    receiving: { label: "Đang nhập kho", className: "bg-sky-50 text-sky-700 border-sky-200" },
    confirmed: { label: "Hoàn thành", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    cancelled: { label: "Đã hủy", className: "bg-rose-50 text-rose-700 border-rose-200" },
  };

  const statusInfo = statusDetails[receipt.status] || { label: receipt.status, className: "bg-slate-100 text-slate-700" };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[94vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Modal Top Header */}
        <div className="border-b border-slate-200 bg-white px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Chi tiết phiếu nhập kho
              </h2>
              <span className="font-mono text-xs font-bold text-cyan-800 bg-cyan-50 px-2.5 py-1 rounded border border-cyan-200">
                {receipt.receiptCode}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${statusInfo.className}`}>
                {statusInfo.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Khởi tạo lúc: {new Date(receipt.createdAt).toLocaleString("vi-VN")}
              {receipt.receivedAt && (
                <> · Nhập kho lúc: {new Date(receipt.receivedAt).toLocaleString("vi-VN")}</>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => copyToClipboard(receipt.receiptCode, "receipt-code", "Mã phiếu")}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              {copiedKey === "receipt-code" ? "Đã chép mã" : "Sao chép mã"}
            </button>
            {allSerialsList.length > 0 && (
              <button
                type="button"
                onClick={handleCopyAllImeis}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
              >
                {copiedKey === "all-imeis" ? "Đã chép thiết bị" : `Sao chép ${allSerialsList.length} máy`}
              </button>
            )}
            {receipt.status === "confirmed" && allSerialsList.some((unit) => unit.internalBarcode) && (
              <button
                type="button"
                onClick={handlePrintUnitLabels}
                className="inline-flex items-center gap-1.5 rounded border border-violet-700 bg-violet-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-800 transition-colors shadow-sm"
              >
                <Printer className="h-3.5 w-3.5" /> In tem mã vạch
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="rounded border border-cyan-700 bg-cyan-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-cyan-800 transition-colors shadow-sm"
            >
              In phiếu nhập
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="text-slate-400 hover:text-slate-600 rounded p-1.5 hover:bg-slate-100 transition-colors text-sm font-semibold leading-none ml-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* 4 Metadata Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Supplier */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                {receipt.receiptKind && receipt.receiptKind !== "purchase" ? "Khách hàng" : "Nhà cung cấp"}
              </span>
              <p className="text-sm font-bold text-slate-900 truncate" title={receipt.supplierName}>
                {receipt.supplierName || "—"}
              </p>
              {supplier && (
                <div className="text-xs text-slate-600 space-y-0.5 pt-0.5">
                  {supplier.phone && <p>SĐT: <span className="font-medium text-slate-800">{supplier.phone}</span></p>}
                  {supplier.code && <p>Mã: <span className="font-mono text-slate-700">{supplier.code}</span></p>}
                  {supplier.address && <p className="truncate" title={supplier.address}>ĐC: {supplier.address}</p>}
                </div>
              )}
            </div>

            {/* Card 2: Warehouse */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                Kho tiếp nhận
              </span>
              <p className="text-sm font-bold text-slate-900">
                {warehouse?.name || "Kho Tổng / Kho chính"}
              </p>
              <div className="text-xs text-slate-600 space-y-0.5 pt-0.5">
                <p>Mã kho: <span className="font-mono text-slate-700">{warehouse?.code || "MAIN"}</span></p>
                <p>Loại kho: <span className="text-slate-800">{warehouse?.kind === "central" ? "Kho trung tâm" : "Kho bán hàng"}</span></p>
              </div>
            </div>

            {/* Card 3: Creator & Operators */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                Người thực hiện
              </span>
              <p className="text-sm font-bold text-slate-900">
                {receipt.createdByName || receipt.createdBy || "Hệ thống"}
              </p>
              <div className="text-xs text-slate-600 space-y-0.5 pt-0.5">
                <p>Người tạo: <span className="text-slate-800">{receipt.createdByName || "Nhân viên kho"}</span></p>
                {(receipt as any).confirmedByName && (
                  <p>Người duyệt: <span className="font-semibold text-emerald-800">{(receipt as any).confirmedByName}</span></p>
                )}
              </div>
            </div>

            {/* Card 4: Notes */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                Ghi chú phiếu nhập
              </span>
              <p className="text-xs text-slate-700 italic leading-relaxed">
                {receipt.notes ? `"${receipt.notes}"` : "Không có ghi chú"}
              </p>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-6 text-xs">
              <div>
                <span className="text-slate-500 font-medium">Số mặt hàng:</span>{" "}
                <strong className="text-sm font-bold text-slate-900">{receipt.items.length} SKU</strong>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Tổng số lượng:</span>{" "}
                <strong className="text-sm font-bold text-slate-900">{totalQuantity} máy</strong>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Tổng số IMEI:</span>{" "}
                <strong className={`text-sm font-bold ${allSerialsList.length === totalQuantity ? "text-emerald-700" : "text-amber-700"}`}>
                  {allSerialsList.length} / {totalQuantity} máy có định danh
                </strong>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Tổng tiền thanh toán:</span>
              <span className="text-base font-bold text-cyan-900 tabular-nums">
                {receipt.subtotal.toLocaleString("vi-VN")} ₫
              </span>
            </div>
          </div>

          {/* Search device identifiers inside receipt */}
          {allSerialsList.length > 0 && (
            <div className="flex items-center gap-3 print:hidden">
              <input
                type="text"
                placeholder="Tìm serial, IMEI hoặc barcode trong phiếu..."
                value={searchImeiQuery}
                onChange={(e) => setSearchImeiQuery(e.target.value)}
                className="w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 shadow-sm"
              />
              {searchImeiQuery && (
                <button
                  type="button"
                  onClick={() => setSearchImeiQuery("")}
                  className="text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  Xóa lọc
                </button>
              )}
              {searchImeiQuery && (
                <span className="text-xs font-semibold text-cyan-800">
                  Khớp {allSerialsList.filter((unit) => [unit.internalBarcode, unit.serialNumber, unit.imei1, unit.imei2].some((value) => value?.toLowerCase().includes(searchImeiQuery.toLowerCase()))).length} máy
                </span>
              )}
            </div>
          )}

          {/* Items Table with expandable IMEI list */}
          <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 font-semibold text-slate-700 uppercase tracking-wide border-b border-slate-200">
                <tr>
                  <th className="p-3 w-10 text-center">#</th>
                  <th className="p-3 w-[30%]">Sản phẩm &amp; Biến thể</th>
                  <th className="p-3 font-mono">Mã SKU</th>
                  <th className="p-3 text-center">Hình thức kho</th>
                  <th className="p-3 text-right">Số lượng</th>
                  <th className="p-3 text-right">BH NCC</th>
                  <th className="p-3 text-right">Đơn giá</th>
                  <th className="p-3 text-right">Thành tiền</th>
                  <th className="p-3 text-center w-28 print:hidden">Chi tiết IMEI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipt.items.map((item, index) => {
                  const details = item.unitDetails || [];
                  const serials = details.length
                    ? Array.from({ length: Math.max(details.length, item.serialNumbers?.length || 0) }, (_, unitIndex) => details[unitIndex]?.serialNumber || item.serialNumbers?.[unitIndex] || "")
                    : (item.serialNumbers || []).filter((s) => s && s.trim());
                  const hasSerials = details.length > 0 || serials.length > 0;
                  const isExpanded = Boolean(expandedImeiIndex[index]);
                  const detail = productDetails[item.productId];
                  const variant = detail?.variants.find((v) => v._id === item.variantId || v.sku === item.sku);
                  const displayVariantName = item.displayName || variant?.displayName;

                  // Check if this item matches search
                  const q = searchImeiQuery.trim().toLowerCase();
                  const matchesSearch = !q || details.some((unit) => [unit.internalBarcode, unit.serialNumber, unit.imei1, unit.imei2].some((value) => value?.toLowerCase().includes(q))) || serials.some((s) => s.toLowerCase().includes(q)) || item.sku.toLowerCase().includes(q) || item.productName.toLowerCase().includes(q);

                  if (q && !matchesSearch) return null;

                  return (
                    <React.Fragment key={`${item.variantId}-${index}`}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 text-center text-slate-400 font-medium">
                          {index + 1}
                        </td>
                        <td className="p-3">
                          <p className="font-semibold text-slate-900 text-xs">
                            {item.productName}
                          </p>
                          {displayVariantName && (
                            <p className="text-[11px] font-medium text-cyan-800 mt-0.5">
                              {displayVariantName}
                            </p>
                          )}
                          {item.barcode && (
                            <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                              Mã vạch: {item.barcode}
                            </p>
                          )}
                        </td>
                        <td className="p-3 font-mono text-xs font-semibold text-slate-700">
                          {item.sku}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium border ${
                            item.trackingMode === "serial"
                              ? "bg-purple-50 text-purple-700 border-purple-200 font-semibold"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}>
                            {trackingLabels[item.trackingMode || "quantity"] || item.trackingMode || "Số lượng"}
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold tabular-nums text-slate-900 text-xs">
                          {item.quantity}
                        </td>
                        <td className="p-3 text-right tabular-nums text-slate-600">
                          {item.supplierWarrantyMonths ? `${item.supplierWarrantyMonths} tháng` : "—"}
                        </td>
                        <td className="p-3 text-right tabular-nums text-slate-700">
                          {item.unitCost.toLocaleString("vi-VN")} ₫
                        </td>
                        <td className="p-3 text-right font-bold tabular-nums text-slate-900">
                          {item.lineTotal.toLocaleString("vi-VN")} ₫
                        </td>
                        <td className="p-3 text-center print:hidden">
                          {item.trackingMode === "serial" || hasSerials ? (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedImeiIndex((curr) => ({
                                  ...curr,
                                  [index]: !curr[index],
                                }))
                              }
                              className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-colors border ${
                                hasSerials
                                  ? "bg-cyan-50 border-cyan-200 text-cyan-800 hover:bg-cyan-100"
                                  : "bg-rose-50 border-rose-200 text-rose-700"
                              }`}
                            >
                              {hasSerials ? `${Math.max(details.length, serials.length)} máy ${isExpanded ? "▲" : "▼"}` : "Chưa có chi tiết máy"}
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Sub-row: IMEI List */}
                      {((isExpanded && hasSerials) || (Boolean(q) && hasSerials)) && (
                        <tr className="bg-slate-50/70 border-b border-slate-200">
                          <td colSpan={9} className="p-3 pl-12 pr-6">
                            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2 shadow-sm">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-800 text-xs">
                                    Danh sách {Math.max(details.length, serials.length)} máy của SKU {item.sku}:
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    (Click vào mã bất kỳ để sao chép)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    copyToClipboard(
                                      details.map((unit, unitIndex) => [unit.serialNumber || serials[unitIndex], unit.imei1, unit.imei2, unit.internalBarcode].filter(Boolean).join("\t")).join("\n"),
                                      `sku-imei-${index}`,
                                      `${Math.max(details.length, serials.length)} máy của SKU ${item.sku}`
                                    )
                                  }
                                  className="text-xs font-semibold text-cyan-700 hover:text-cyan-900 hover:underline"
                                >
                                  {copiedKey === `sku-imei-${index}` ? "Đã sao chép" : "Sao chép toàn bộ"}
                                </button>
                              </div>

                              {/* Monospace chips grid */}
                              <div className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 max-h-48 overflow-y-auto pt-1">
                                {serials.map((sn, sIdx) => {
                                    const unit = details[sIdx] || {};
                                    const isMatched = q && [sn, unit.internalBarcode, unit.imei1, unit.imei2].some((value) => value?.toLowerCase().includes(q));

                                  return (
                                    <div
                                      key={sIdx}
                                      onClick={() => copyToClipboard([sn, unit.imei1, unit.imei2, unit.internalBarcode].filter(Boolean).join("\t"), `sn-${index}-${sIdx}`, `thông tin máy ${sn}`)}
                                      className={`flex items-center justify-between rounded px-2.5 py-1 border font-mono text-[11px] cursor-pointer transition-colors shadow-2xs ${
                                        isMatched
                                          ? "bg-amber-100 border-amber-300 text-amber-900 font-bold"
                                          : "bg-slate-50 border-slate-200 text-slate-800 hover:bg-cyan-50 hover:border-cyan-300 hover:text-cyan-900"
                                      }`}
                                      title="Bấm để sao chép mã này"
                                    >
                                      <span className="truncate">
                                        <span className="text-slate-400 font-sans mr-1">#{sIdx + 1}</span>
                                        {sn || unit.imei1 || unit.imei2 || unit.internalBarcode}
                                      </span>
                                      {unit.internalBarcode && (
                                        <span className="text-[9px] font-sans text-slate-400 font-medium ml-1 truncate max-w-[80px]" title={`Barcode: ${unit.internalBarcode}`}>
                                          BC: {unit.internalBarcode}
                                        </span>
                                      )}
                                      {(unit.imei1 || unit.imei2) && <span className="ml-1 truncate text-[9px] text-slate-400">{[unit.imei1 && `I1 ${unit.imei1}`, unit.imei2 && `I2 ${unit.imei2}`].filter(Boolean).join(" · ")}</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="text-xs text-slate-500">
            Tổng cộng: <strong className="text-slate-900">{receipt.items.length} mặt hàng</strong> ·{" "}
            Tổng SL: <strong className="text-slate-900">{totalQuantity} máy</strong> ·{" "}
            Tổng tiền: <strong className="text-cyan-900 font-bold">{receipt.subtotal.toLocaleString("vi-VN")} ₫</strong>
          </div>

          <div className="flex items-center gap-3">
            {allSerialsList.length > 0 && (
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeImeisInPrint}
                  onChange={(e) => setIncludeImeisInPrint(e.target.checked)}
                  className="rounded border-slate-300 text-cyan-700 focus:ring-cyan-600 h-3.5 w-3.5"
                />
                In kèm danh sách IMEI
              </label>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-md bg-cyan-700 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-800 transition-colors shadow-sm"
            >
              In phiếu nhập
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
