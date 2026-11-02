import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Hash,
  MapPin,
  Package,
  Printer,
  Search,
  ShoppingCart,
  Tag,
  User,
  X,
} from "lucide-react";
import { StockLog } from "../../../types";
import {
  GoodsReceipt,
  inventoryReceivingService,
  Warehouse,
} from "../../../services/inventoryReceivingService";
import { toast } from "../../../pages/Toast";
import {
  formatLogDate,
  formatNumber,
  getLogItems,
  getLogStatus,
  getLogTitle,
  getStatusTone,
  isPosSalesLog,
} from "./stockLogUtils";
import { printOutboundVoucher } from "../outbound/printOutboundVoucher";
import { printReceiptVoucher } from "../receiving/printReceiptVoucher";

interface StockLogDetailModalProps {
  log: StockLog;
  warehouses?: Warehouse[];
  onClose: () => void;
  onEdit?: () => void;
}

const formatMoney = (val?: number) => {
  if (typeof val !== "number" || isNaN(val)) return null;
  return new Intl.NumberFormat("vi-VN").format(val) + " ₫";
};

export function StockLogDetailModal({
  log,
  warehouses = [],
  onClose,
  onEdit,
}: StockLogDetailModalProps) {
  const isInbound = log.type === "nhập";
  const isPos = isPosSalesLog(log);
  const status = getLogStatus(log);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedImeis, setExpandedImeis] = useState<Record<number, boolean>>({});
  const [searchImeiQuery, setSearchImeiQuery] = useState("");
  const [linkedReceipt, setLinkedReceipt] = useState<GoodsReceipt | null>(null);
  const [loadingLinked, setLoadingLinked] = useState(false);

function isHexObjectId(str?: string): boolean {
  if (!str) return false;
  return /^[0-9a-fA-F]{24}$/.test(str.trim());
}

  // Parse reference code if exists (e.g. PN-MAIN-20260923-0001, XK-..., POS...)
  // Bỏ hoàn toàn các dạng mã hex hệ thống / ObjectId kỹ thuật (như 6ab377932cfb5e00e249096a)
  const referenceCode = useMemo(() => {
    const fromTitle = log.title?.match(/(?:PN|XK|POS|HD|XUAT|NHAP)-[A-Z0-9-]+/i)?.[0];
    if (fromTitle && !isHexObjectId(fromTitle)) return fromTitle;
    const fromNotes = log.notes?.match(/(?:PN|XK|POS|HD|XUAT|NHAP)-[A-Z0-9-]+/i)?.[0];
    if (fromNotes && !isHexObjectId(fromNotes)) return fromNotes;
    const rawRef = (log as any).sourceCode || (log as any).receiptCode;
    if (rawRef && typeof rawRef === "string" && rawRef.length < 30 && !isHexObjectId(rawRef)) return rawRef;
    if (log.id && !isHexObjectId(log.id)) return log.id;
    return null;
  }, [log]);

  // Attempt to fetch linked GoodsReceipt if inbound to get original supplier, amounts and serials
  useEffect(() => {
    let active = true;
    const receiptCodeMatch =
      log.title?.match(/PN-[A-Z0-9-]+/i)?.[0] ||
      log.notes?.match(/PN-[A-Z0-9-]+/i)?.[0] ||
      ((log as any).refType === "goods-receipt" ? (log as any).refId : undefined);

    if (isInbound && receiptCodeMatch) {
      setLoadingLinked(true);
      inventoryReceivingService
        .listReceipts({ limit: 50 })
        .then((res) => {
          if (!active) return;
          const found = res.items.find(
            (r) =>
              r.receiptCode.toUpperCase() === receiptCodeMatch.toUpperCase() ||
              r._id === receiptCodeMatch ||
              r._id === (log as any).refId
          );
          if (found) {
            setLinkedReceipt(found);
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (active) setLoadingLinked(false);
        });
    }

    return () => {
      active = false;
    };
  }, [isInbound, log]);

  // Resolve warehouse
  const resolvedWarehouse = useMemo(() => {
    const targetId = log.warehouseId || linkedReceipt?.warehouseId;
    if (targetId) {
      return warehouses.find((w) => w._id === targetId);
    }
    return warehouses.find((w) => w.isDefault) || warehouses[0] || null;
  }, [warehouses, log.warehouseId, linkedReceipt]);

  // Merge items from log and linked receipt to obtain unit prices, costs, and serial numbers
  const rawItems = getLogItems(log);
  const items = useMemo(() => {
    return rawItems.map((item) => {
      const receiptItem = linkedReceipt?.items.find(
        (ri) => ri.sku.toLowerCase() === item.sku.toLowerCase()
      );

      const serialNumbers =
        item.serialNumbers?.length
          ? item.serialNumbers
          : receiptItem?.serialNumbers?.length
          ? receiptItem.serialNumbers
          : [];

      const unitCost = item.unitCost ?? receiptItem?.unitCost;
      const unitPrice = item.unitPrice;
      const effectivePrice = unitPrice ?? unitCost;
      const lineTotal =
        item.lineTotal ??
        receiptItem?.lineTotal ??
        (effectivePrice ? effectivePrice * item.quantity : undefined);

      return {
        ...item,
        unitCost,
        unitPrice,
        effectivePrice,
        lineTotal,
        serialNumbers,
      };
    });
  }, [rawItems, linkedReceipt]);

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  // Total financial value if available
  const totalAmount = useMemo(() => {
    if (linkedReceipt?.subtotal) return linkedReceipt.subtotal;
    const computed = items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
    return computed > 0 ? computed : null;
  }, [linkedReceipt, items]);

  // Copy helper
  const copyToClipboard = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Đã sao chép ${label}!`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Collect all IMEIs
  const allSerials = useMemo(() => {
    const list: Array<{ sku: string; serial: string }> = [];
    items.forEach((item) => {
      (item.serialNumbers || []).forEach((sn) => {
        if (sn?.trim()) list.push({ sku: item.sku, serial: sn.trim() });
      });
      (item.unitIdentifiers || []).forEach((code) => {
        if (code?.trim()) list.push({ sku: item.sku, serial: code.trim() });
      });
    });
    return list;
  }, [items]);

  const handleCopyAllImeis = () => {
    if (allSerials.length === 0) {
      toast.info("Phiếu này không có mã IMEI nào để sao chép.");
      return;
    }
    const text = allSerials.map((s) => `${s.sku}\t${s.serial}`).join("\n");
    copyToClipboard(text, "all-imeis", `${allSerials.length} mã IMEI`);
  };

  // Print voucher handler
  const handlePrint = () => {
    if (isInbound && linkedReceipt) {
      printReceiptVoucher({
        receipt: linkedReceipt,
        warehouse: resolvedWarehouse || undefined,
        includeSerials: true,
      });
      return;
    }

    if (!isInbound) {
      printOutboundVoucher({
        ticket: {
          id: referenceCode || log.id,
          title: getLogTitle(log),
          createdAt: log.createdAt,
          status: status,
          purpose: log.purpose,
          customerId: log.customerId,
          customerName: log.customerName,
          operatorName: log.operatorName,
          notes: log.notes,
          warehouseId: resolvedWarehouse?._id,
          items: items.map((item) => ({
            sku: item.sku,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            unitCost: item.unitCost,
            serialNumbers: item.serialNumbers,
            unitIdentifiers: item.unitIdentifiers,
          })),
        },
        warehouse: resolvedWarehouse,
        includeSerials: true,
      });
      return;
    }

    // Default fallback print
    window.print();
  };

  const partnerName =
    log.customerName ||
    linkedReceipt?.supplierName ||
    (isInbound ? "Nhà cung cấp đối tác" : isPos ? "Khách hàng lẻ (POS)" : null);

  const purposeDisplay = useMemo(() => {
    if (isPos) return "Bán lẻ tại quầy (POS)";
    if (log.purpose === "bán") return "Xuất bán hàng";
    if (log.purpose === "chuyển kho") return "Điều chuyển kho";
    if (log.purpose === "nội bộ") return "Sử dụng nội bộ";
    if (log.purpose === "hủy") return "Hủy / Hỏng / Lỗi";
    if (isInbound) return "Nhập mua hàng NCC";
    return log.purpose || (isInbound ? "Nhập kho" : "Xuất kho");
  }, [isPos, log.purpose, isInbound]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chi tiết giao dịch kho"
        className="flex w-full max-w-4xl flex-col max-h-[92dvh] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                  isInbound
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : isPos
                    ? "border-sky-200 bg-sky-50 text-sky-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {isInbound ? (
                  <>
                    <ArrowDownLeft className="h-3.5 w-3.5" /> Nhập kho
                  </>
                ) : isPos ? (
                  <>
                    <ShoppingCart className="h-3.5 w-3.5" /> Bán POS
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="h-3.5 w-3.5" /> Xuất kho
                  </>
                )}
              </span>

              {/* Reference / Document code - chỉ hiển thị khi có mã chứng từ nghiệp vụ, không hiển thị mã ID hex hệ thống */}
              {referenceCode && (
                <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100/80 px-2 py-0.5 font-mono text-xs font-bold text-slate-800">
                  <Hash className="h-3 w-3 text-slate-400" />
                  {referenceCode}
                </span>
              )}

              {/* Status Badge */}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${getStatusTone(
                  status
                )}`}
              >
                {status}
              </span>
            </div>

            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              {getLogTitle(log)}
            </h3>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                {formatLogDate(log.createdAt)}
              </span>
            </div>
          </div>

          {/* Quick Actions in Header */}
          <div className="flex items-center gap-2">
            {referenceCode && (
              <button
                type="button"
                onClick={() => copyToClipboard(referenceCode, "code", "Mã chứng từ")}
                className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <Copy className="h-3.5 w-3.5 text-slate-400" />
                {copiedKey === "code" ? "Đã chép" : "Sao chép mã"}
              </button>
            )}

            {status === "Đang chờ" && onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100 transition-colors"
              >
                Sửa phiếu
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6 overscroll-contain">
          {/* 4 Metadata Cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {/* Card 1: Loại & Mục đích */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                Mục đích & Kênh
              </span>
              <p className="text-sm font-extrabold text-slate-900 truncate">
                {purposeDisplay}
              </p>
              <span className="text-[11px] text-slate-500 font-medium block">
                {isPos
                  ? "Bán lẻ thanh toán tại quầy"
                  : isInbound
                  ? "Nhập kho chính thức"
                  : "Xuất kho điều phối"}
              </span>
            </div>

            {/* Card 2: Kho lưu trữ */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                Kho thực hiện
              </span>
              <p className="text-sm font-extrabold text-slate-900 truncate flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                <span className="truncate">
                  {resolvedWarehouse ? resolvedWarehouse.name : "Kho mặc định chi nhánh"}
                </span>
              </p>
              <span className="text-[11px] text-slate-500 font-medium block truncate">
                {resolvedWarehouse?.code ? `Mã kho: ${resolvedWarehouse.code}` : "Kho chính"}
              </span>
            </div>

            {/* Card 3: Đối tác / Khách hàng / Phụ trách */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                {isInbound ? "Nhà cung cấp / Phụ trách" : "Khách hàng / Phụ trách"}
              </span>
              <p className="text-sm font-extrabold text-slate-900 truncate" title={partnerName || ""}>
                {partnerName || "Khách lẻ / Nội bộ"}
              </p>
              <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1 truncate">
                <User className="h-3 w-3 text-slate-400" />
                {log.operatorName || "Chưa rõ người tạo"}
              </span>
            </div>

            {/* Card 4: Sản lượng & Giá trị */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                Biến động & Giá trị
              </span>
              <p
                className={`text-sm font-black tabular-nums ${
                  isInbound ? "text-emerald-700" : isPos ? "text-sky-700" : "text-rose-700"
                }`}
              >
                {isInbound ? "+" : "-"}
                {formatNumber(totalQuantity)}{" "}
                <span className="text-xs font-semibold text-slate-500">máy / sp</span>
              </p>
              <span className="text-[11px] text-slate-600 font-bold block tabular-nums">
                {totalAmount ? `Tổng: ${formatMoney(totalAmount)}` : `${items.length} dòng sản phẩm`}
              </span>
            </div>
          </div>

          {/* Table of Items */}
          <section className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Package className="h-4 w-4 text-slate-500" />
                <span>{isInbound ? "Hàng nhập" : "Hàng xuất"}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {items.length} mặt hàng
                </span>
              </h4>

              <div className="flex items-center gap-2">
                {allSerials.length > 0 && (
                  <button
                    type="button"
                    onClick={handleCopyAllImeis}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                  >
                    <Copy className="h-3 w-3 text-slate-400" />
                    {copiedKey === "all-imeis"
                      ? "Đã chép toàn bộ"
                      : `Sao chép ${allSerials.length} IMEI`}
                  </button>
                )}
                <span className="text-xs text-slate-500">
                  Tổng {isInbound ? "nhập" : "xuất"}:{" "}
                  <strong className={isInbound ? "text-emerald-700" : "text-rose-700"}>
                    {isInbound ? "+" : "-"}
                    {formatNumber(totalQuantity)} sp
                  </strong>
                </span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
              <table className="w-full min-w-[620px] text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-3.5 py-2.5 w-12 text-center">
                      #
                    </th>
                    <th scope="col" className="px-3.5 py-2.5">
                      Sản phẩm
                    </th>
                    <th scope="col" className="px-3.5 py-2.5">
                      SKU
                    </th>
                    <th scope="col" className="px-3.5 py-2.5 text-right">
                      Đơn giá
                    </th>
                    <th scope="col" className="px-3.5 py-2.5 text-right">
                      {isInbound ? "SL nhập" : "SL xuất"}
                    </th>
                    <th scope="col" className="px-3.5 py-2.5 text-right">
                      Thành tiền
                    </th>
                    <th scope="col" className="px-3.5 py-2.5">
                      IMEI / Serial
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.map((item, index) => {
                    const serials = item.serialNumbers || [];
                    const unitIdentifiers = item.unitIdentifiers || [];
                    const isExpanded = Boolean(expandedImeis[index]);

                    return (
                      <tr key={`${item.sku}-${index}`} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-3.5 py-3 text-center text-slate-400 font-mono text-xs">
                          {index + 1}
                        </td>
                        <td className="px-3.5 py-3 font-semibold text-slate-800">
                          {item.productName}
                        </td>
                        <td className="px-3.5 py-3 font-mono text-[11px] font-semibold text-slate-600">
                          {item.sku}
                        </td>
                        <td className="px-3.5 py-3 text-right tabular-nums text-slate-600">
                          {formatMoney(item.effectivePrice) || "—"}
                        </td>
                        <td
                          className={`px-3.5 py-3 text-right font-extrabold tabular-nums ${
                            isInbound ? "text-emerald-700" : isPos ? "text-sky-700" : "text-rose-700"
                          }`}
                        >
                          {isInbound ? "+" : "-"}
                          {formatNumber(item.quantity)}
                        </td>
                        <td className="px-3.5 py-3 text-right font-bold tabular-nums text-slate-800">
                          {formatMoney(item.lineTotal) || "—"}
                        </td>
                        <td className="px-3.5 py-3 text-xs max-w-xs">
                          {serials.length > 0 ? (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800 border border-teal-200/80">
                                  <Tag className="h-3 w-3" />
                                  {serials.length} IMEI
                                </span>
                                {serials.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedImeis((prev) => ({
                                        ...prev,
                                        [index]: !prev[index],
                                      }))
                                    }
                                    className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-teal-700 hover:text-teal-900 cursor-pointer"
                                  >
                                    {isExpanded ? (
                                      <>
                                        Thu gọn <ChevronUp className="h-3 w-3" />
                                      </>
                                    ) : (
                                      <>
                                        Xem tất cả ({serials.length}) <ChevronDown className="h-3 w-3" />
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-1">
                                {(isExpanded ? serials : serials.slice(0, 2)).map((sn, sIdx) => (
                                  <span
                                    key={sIdx}
                                    onClick={() => copyToClipboard(sn, `sn-${index}-${sIdx}`, "mã IMEI")}
                                    className="group inline-flex items-center gap-1 rounded bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer"
                                    title="Bấm để sao chép"
                                  >
                                    <span>{sn}</span>
                                    <Copy className="h-2.5 w-2.5 text-slate-400 group-hover:text-slate-600" />
                                  </span>
                                ))}
                                {!isExpanded && serials.length > 2 && (
                                  <span className="text-[10px] text-slate-400 font-medium self-center">
                                    +{serials.length - 2} khác
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : unitIdentifiers.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {unitIdentifiers.map((code, cIdx) => (
                                <span
                                  key={cIdx}
                                  onClick={() => copyToClipboard(code, `code-${index}-${cIdx}`, "mã vạch")}
                                  className="group inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-amber-800 border border-amber-200 cursor-pointer"
                                  title="Mã vạch nội bộ"
                                >
                                  <span>{code}</span>
                                  <Copy className="h-2.5 w-2.5 text-amber-500" />
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">
                              Không theo dõi IMEI
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Notes */}
          {log.notes && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2 text-xs">
              <div>
                <span className="font-bold text-slate-700">Ghi chú phiếu: </span>
                <span className="text-slate-600">{log.notes}</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/80 px-5 py-3.5 sm:px-6">
          <div className="text-xs text-slate-500">
            {loadingLinked && (
              <span className="inline-flex items-center gap-1.5 text-teal-700">
                <span className="h-2 w-2 animate-ping rounded-full bg-teal-500" />
                Đang đối soát chứng từ liên kết...
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Printer className="h-4 w-4 text-slate-500" />
              In phiếu
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
