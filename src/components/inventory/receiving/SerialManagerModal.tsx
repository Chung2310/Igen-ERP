import React, { useMemo, useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, Printer } from "lucide-react";
import { toast } from "../../../pages/Toast";
import type { GoodsReceiptItem } from "../../../services/inventoryReceivingService";
import { inventorySerialService } from "../../../services/inventorySerialService";
import { printDeviceBarcodeLabels, type DeviceBarcodeLabel } from "./printDeviceBarcodeLabels";

type DraftLine = GoodsReceiptItem & { key: string; displayName: string };

interface SerialManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  line: DraftLine;
  onSave: (updatedLine: DraftLine) => void;
  otherLinesSerials?: string[];
}

export function SerialManagerModal({
  isOpen,
  onClose,
  line,
  onSave,
  otherLinesSerials = [],
}: SerialManagerModalProps) {
  const [activeTab, setActiveTab] = useState<"scan" | "paste" | "list">("scan");

  // Số lượng cố định từ phiếu nhập, không cho phép sửa đổi tại modal nhập IMEI
  const currentQty = useMemo(() => Math.max(1, Math.round(line.quantity)), [line.quantity]);
  const [serials, setSerials] = useState<string[]>(() => {
    const list = line.serialNumbers || [];
    const details = line.unitDetails || [];
    return Array.from({ length: currentQty }, (_, i) => list[i] || details[i]?.serialNumber || "");
  });
  const [unitDetails, setUnitDetails] = useState<Array<{ internalBarcode?: string; serialNumber?: string; imei1?: string; imei2?: string }>>(() => {
    const list = line.unitDetails || [];
    return Array.from({ length: currentQty }, (_, i) => ({
      internalBarcode: list[i]?.internalBarcode,
      serialNumber: list[i]?.serialNumber,
      imei1: list[i]?.imei1,
      imei2: list[i]?.imei2,
    }));
  });
  const [generatingBarcodes, setGeneratingBarcodes] = useState(false);
  const [expandedImeiUnits, setExpandedImeiUnits] = useState<Record<number, boolean>>({});
  const [barcodeFeedback, setBarcodeFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const handleGenerateInternalBarcodes = async (indexes: number[], replaceExisting = false) => {
    const targets = indexes.filter((index) => replaceExisting || !unitDetails[index]?.internalBarcode?.trim());
    if (targets.length === 0) {
      setBarcodeFeedback({ type: "info", message: "Các thiết bị đã có mã quản lý." });
      return;
    }

    setBarcodeFeedback(null);
    setGeneratingBarcodes(true);
    try {
      const barcodes = await inventorySerialService.allocateInternalBarcodes(targets.length);
      if (barcodes.length !== targets.length) throw new Error("Số mã được cấp không khớp số thiết bị.");
      const barcodeByIndex = new Map(targets.map((index, barcodeIndex) => [index, barcodes[barcodeIndex]]));
      setUnitDetails((current) => current.map((unit, index) => {
        const barcode = barcodeByIndex.get(index);
        if (!barcode || (!replaceExisting && unit.internalBarcode?.trim())) return unit;
        return { ...unit, internalBarcode: barcode };
      }));
      setBarcodeFeedback({ type: "success", message: `Đã tự sinh ${barcodes.length} mã quản lý.` });
    } catch (error) {
      setBarcodeFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Không thể tự sinh mã quản lý.",
      });
    } finally {
      setGeneratingBarcodes(false);
    }
  };

  const handlePrintBarcodes = () => {
    const labels: DeviceBarcodeLabel[] = Array.from({ length: currentQty }, (_, index) => index)
      .map((index) => ({
        internalBarcode: unitDetails[index]?.internalBarcode || "",
        sku: line.sku || line.variantId,
        productName: line.productName || line.displayName || line.sku || "Thiết bị",
        serialNumber: serials[index]?.trim() || undefined,
        imei1: unitDetails[index]?.imei1,
        imei2: unitDetails[index]?.imei2,
      }))
      .filter((label) => label.internalBarcode.trim());

    if (labels.length !== currentQty) {
      setBarcodeFeedback({ type: "info", message: `Hãy tự sinh mã còn thiếu để in đủ ${currentQty} tem.` });
      return;
    }

    try {
      printDeviceBarcodeLabels(labels);
      setBarcodeFeedback({ type: "success", message: `Đã mở cửa sổ in ${labels.length} tem barcode.` });
    } catch (error) {
      setBarcodeFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Không thể mở trang in tem barcode.",
      });
    }
  };

  // Scanner state
  const [scanInput, setScanInput] = useState("");
  const [scanLastSuccess, setScanLastSuccess] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const scannerInputRef = useRef<HTMLInputElement>(null);

  // Paste state
  const [pasteRawText, setPasteRawText] = useState("");

  // Focus scanner input on tab change to scan
  useEffect(() => {
    if (activeTab !== "scan" || !isOpen) return;

    const frame = window.requestAnimationFrame(() => {
      scannerInputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, isOpen]);

  // Valid count
  const filledSerials = useMemo(() => {
    return serials.map((s) => s.trim()).filter(Boolean);
  }, [serials]);

  const uniqueFilledCount = useMemo(() => {
    return new Set(filledSerials.map((s) => s.toUpperCase())).size;
  }, [filledSerials]);

  const hasInternalDuplicates = filledSerials.length !== uniqueFilledCount;

  // Check collision with other lines
  const collisionWithOtherLines = useMemo(() => {
    const otherSet = new Set(otherLinesSerials.map((s) => s.trim().toUpperCase()));
    return filledSerials.filter((s) => otherSet.has(s.toUpperCase()));
  }, [filledSerials, otherLinesSerials]);

  // Continuous Scanner submit
  const handleScannerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = scanInput.trim();
    if (!val) return;

    setScanError(null);
    setScanLastSuccess(null);

    // Check if duplicate in current list
    const upper = val.toUpperCase();
    if (serials.some((s) => s.trim().toUpperCase() === upper)) {
      setScanError(`IMEI "${val}" đã tồn tại trong danh sách của SKU này!`);
      setScanInput("");
      return;
    }

    if (otherLinesSerials.some((s) => s.trim().toUpperCase() === upper)) {
      setScanError(`IMEI "${val}" đã được nhập cho một SKU khác trong phiếu nhập!`);
      setScanInput("");
      return;
    }

    // Find first empty slot
    const firstEmptyIndex = serials.findIndex((s) => !s.trim());
    if (firstEmptyIndex !== -1) {
      const nextSerials = [...serials];
      nextSerials[firstEmptyIndex] = val;
      setSerials(nextSerials);
      setScanLastSuccess(`Đã thêm: ${val} (Vị trí #${firstEmptyIndex + 1} / ${currentQty})`);
    } else {
      setScanError(`Đã đủ số lượng ${currentQty} máy theo phiếu nhập. Không thể quét thêm.`);
    }

    setScanInput("");
  };

  // Parse batch paste text
  const parsedPasteList = useMemo(() => {
    if (!pasteRawText.trim()) return [];
    const tokens = pasteRawText
      .split(/[\n,;\t]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    return tokens;
  }, [pasteRawText]);

  const uniqueParsedPasteList = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const t of parsedPasteList) {
      const upper = t.toUpperCase();
      if (!seen.has(upper)) {
        seen.add(upper);
        list.push(t);
      }
    }
    return list;
  }, [parsedPasteList]);

  const pasteDuplicateCount = parsedPasteList.length - uniqueParsedPasteList.length;

  const handleApplyPaste = () => {
    if (uniqueParsedPasteList.length === 0) {
      toast.error("Không tìm thấy IMEI hợp lệ nào trong văn bản đã dán.");
      return;
    }

    const nextSerials = [...serials];
    let filled = 0;
    for (const imei of uniqueParsedPasteList) {
      const emptyIdx = nextSerials.findIndex((s) => !s.trim());
      if (emptyIdx !== -1) {
        nextSerials[emptyIdx] = imei;
        filled++;
      } else {
        break;
      }
    }

    setSerials(nextSerials);
    if (filled > 0) {
      toast.success(`Đã nạp ${filled} IMEI vào danh sách (${filled}/${currentQty} máy).`);
    } else {
      toast.info(`Danh sách đã đủ ${currentQty} IMEI. Không còn vị trí trống.`);
    }

    setPasteRawText("");
    setActiveTab("list");
  };

  // Clear all IMEIs
  const handleClearAllSerials = () => {
    setSerials(Array.from({ length: currentQty }, () => ""));
    toast.info("Đã xóa sạch danh sách IMEI.");
  };

  // Save changes
  const handleSave = () => {
    if (line.trackingMode === "serial") {
      if (hasInternalDuplicates) {
        toast.error("Phát hiện IMEI bị trùng lặp trong danh sách. Vui lòng kiểm tra lại.");
        return;
      }
      if (collisionWithOtherLines.length > 0) {
        toast.error(`IMEI "${collisionWithOtherLines[0]}" bị trùng với SKU khác trong phiếu nhập.`);
        return;
      }
    }

    const updated: DraftLine = {
      ...line,
      quantity: currentQty,
      serialNumbers: serials.map((s) => s.trim()),
      unitDetails: unitDetails.map((u, i) => ({
        ...u,
        internalBarcode: u.internalBarcode?.trim() || undefined,
        serialNumber: serials[i]?.trim() || undefined,
      })),
    };

    onSave(updated);
    toast.success(`Đã lưu danh sách IMEI cho ${line.sku}!`);
    onClose();
  };

  const progressPercent = Math.min(100, Math.round((filledSerials.length / currentQty) * 100));
  const isComplete = filledSerials.length === currentQty && !hasInternalDuplicates;
  const generatedBarcodeCount = unitDetails.filter((unit) => Boolean(unit.internalBarcode?.trim())).length;
  const missingBarcodeCount = Math.max(0, currentQty - generatedBarcodeCount);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-3 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="flex h-[min(780px,92vh)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                  Quản lý IMEI &amp; Sê-ri
                </h3>
                <span className="max-w-full truncate rounded border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                  {line.sku}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {line.productName}
                {line.displayName && (
                  <>
                    {" · "}
                    <span className="font-medium text-slate-700">{line.displayName}</span>
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="text-slate-400 hover:text-slate-600 rounded p-1 hover:bg-slate-100 transition-colors text-sm font-semibold leading-none"
            >
              ✕
            </button>
          </div>

          {/* KPI & Progress */}
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex items-center gap-6 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-600 font-medium">SL nhập:</span>
                <strong className="font-bold text-slate-900 text-sm tabular-nums">
                  {currentQty}
                </strong>
                <span className="text-slate-500">máy</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-600 font-medium">Đã nhập:</span>
                <strong
                  className={`font-bold tabular-nums text-sm ${
                    isComplete ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {filledSerials.length} / {currentQty}
                </strong>
              </div>
            </div>

            {/* Status Badge */}
            <div>
              {isComplete ? (
                <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  Đã đủ {currentQty} IMEI
                </span>
              ) : filledSerials.length < currentQty ? (
                <span className="inline-block rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                  Còn thiếu {currentQty - filledSerials.length} IMEI
                </span>
              ) : (
                <span className="inline-block rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700 border border-cyan-200">
                  Vượt số lượng (+{filledSerials.length - currentQty})
                </span>
              )}
            </div>
          </div>

          {/* Progress bar line */}
          <div className="mt-2.5 h-1 w-full bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isComplete ? "bg-emerald-600" : "bg-cyan-700"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex shrink-0 gap-4 overflow-x-auto border-b border-slate-200 bg-white px-4 sm:gap-6 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveTab("scan")}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "scan"
                ? "border-cyan-700 text-cyan-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Quét mã vạch liên tục
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("paste")}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "paste"
                ? "border-cyan-700 text-cyan-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Dán danh sách từ Excel
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("list")}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "list"
                ? "border-cyan-700 text-cyan-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>Danh sách chi tiết</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.2 text-[10px] font-bold text-slate-600">
              {filledSerials.length}/{currentQty}
            </span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {/* TAB 1: SCANNER */}
          {activeTab === "scan" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-5">
                <div className="max-w-lg mx-auto text-center space-y-1">
                  <h4 className="text-sm font-semibold text-slate-900">
                    Nhập hoặc quét mã vạch IMEI
                  </h4>
                  <p className="text-xs text-slate-500">
                    Đặt con trỏ vào ô bên dưới rồi cầm máy quét bắn liên tục vào mã vạch IMEI. Hệ thống tự động nhận diện và lưu vào danh sách.
                  </p>
                </div>

                <form onSubmit={handleScannerSubmit} className="mt-4 max-w-lg mx-auto flex gap-2">
                  <div className="relative flex-1">
                    <input
                      ref={scannerInputRef}
                      type="text"
                      placeholder="Nhập hoặc quét mã IMEI tại đây..."
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      className="w-full rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-mono font-semibold text-slate-900 outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 shadow-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="shrink-0 rounded-md bg-cyan-700 px-5 py-2 text-xs font-semibold text-white hover:bg-cyan-800 transition-colors shadow-sm"
                  >
                    Thêm
                  </button>
                </form>


              </div>

              {/* Feedback messages */}
              {scanLastSuccess && (
                <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
                  {scanLastSuccess}
                </div>
              )}
              {scanError && (
                <div className="rounded-md bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-medium text-rose-800">
                  {scanError}
                </div>
              )}

              {/* Recent Scanned Tags */}
              {filledSerials.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      Đã quét gần đây ({filledSerials.length} IMEI):
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab("list")}
                      className="text-cyan-700 hover:underline font-medium"
                    >
                      Xem toàn bộ danh sách
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    {filledSerials.slice(-15).reverse().map((serial, idx) => (
                      <span
                        key={idx}
                        className="rounded bg-white px-2.5 py-1 text-xs font-mono font-medium text-slate-800 border border-slate-200 shadow-sm"
                      >
                        {serial}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BATCH PASTE */}
          {activeTab === "paste" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Dán danh sách IMEI từ Excel / Email / Nhà cung cấp:
                </label>
                <textarea
                  rows={6}
                  placeholder={`861234567890123\n861234567890124\n861234567890125\n...`}
                  value={pasteRawText}
                  onChange={(e) => setPasteRawText(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-3 text-xs font-mono outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 bg-white"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Hỗ trợ sao chép cả cột từ bảng tính Excel. Phân cách bằng dòng mới, dấu phẩy (,), chấm phẩy (;) hoặc tab.
                </p>
              </div>

              {/* Paste Stats Analysis */}
              {parsedPasteList.length > 0 && (
                <div className="rounded-lg border border-cyan-200 bg-cyan-50/50 p-3 text-xs space-y-2">
                  <div className="flex items-center gap-4 font-semibold text-slate-800">
                    <span>Phát hiện: <strong className="text-cyan-800">{parsedPasteList.length}</strong> chuỗi</span>
                    <span>Hợp lệ duy nhất: <strong className="text-emerald-700">{uniqueParsedPasteList.length}</strong> IMEI</span>
                    {pasteDuplicateCount > 0 && (
                      <span className="text-rose-600 font-medium">
                        (Bỏ qua {pasteDuplicateCount} IMEI trùng lặp)
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 pt-1.5 border-t border-cyan-200">
                    Chỉ điền tối đa đúng số lượng theo phiếu nhập ({currentQty} máy).
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={uniqueParsedPasteList.length === 0}
                  onClick={handleApplyPaste}
                  className="rounded-md bg-cyan-700 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-cyan-800 transition-colors disabled:opacity-50"
                >
                  Áp dụng {uniqueParsedPasteList.length} IMEI vào danh sách
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: DETAILED LIST & INTERNAL BARCODES */}
          {activeTab === "list" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold text-slate-700">
                    Danh sách chi tiết {currentQty} máy:
                  </span>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Mã quản lý dùng để in barcode; serial và IMEI nhập theo thông tin trên máy.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={generatingBarcodes || missingBarcodeCount === 0}
                    onClick={() => void handleGenerateInternalBarcodes(Array.from({ length: currentQty }, (_, index) => index))}
                    className="min-w-[148px] whitespace-nowrap rounded border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-center text-xs font-semibold text-cyan-800 hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-60"
                  >
                    {generatingBarcodes ? "Đang tạo mã..." : missingBarcodeCount ? "Tự sinh mã còn thiếu" : "Đã tạo đủ mã"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintBarcodes()}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    title="In trọn bộ tem; cần tạo đủ barcode cho các thiết bị"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    In toàn bộ tem ({generatedBarcodeCount}/{currentQty})
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllSerials}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-rose-600 hover:border-rose-200 transition-colors shadow-sm"
                  >
                    Xóa serial chính
                  </button>
                </div>
              </div>

              <div
                role={barcodeFeedback?.type === "error" ? "alert" : "status"}
                aria-live="polite"
                aria-hidden={!barcodeFeedback}
                className={`flex min-h-9 items-center rounded-md border px-3 py-2 text-xs font-medium ${
                  barcodeFeedback?.type === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : barcodeFeedback?.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : barcodeFeedback?.type === "info"
                        ? "border-slate-200 bg-slate-50 text-slate-700"
                        : "invisible border-transparent bg-transparent"
                }`}
              >
                {barcodeFeedback?.message || " "}
              </div>

              {/* Responsive cards keep every field visible without horizontal scrolling */}
              <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {Array.from({ length: currentQty }).map((_, index) => {
                  const val = serials[index] || "";
                  const isFilled = Boolean(val.trim());
                  const isDup =
                    isFilled &&
                    serials.filter((serial) => serial.trim().toUpperCase() === val.trim().toUpperCase())
                      .length > 1;
                  const secondaryImeiCount = [unitDetails[index]?.imei1, unitDetails[index]?.imei2]
                    .filter((imei) => Boolean(imei?.trim())).length;
                  const isImeiExpanded = Boolean(expandedImeiUnits[index]);

                  return (
                    <article
                      key={index}
                      className={`rounded-lg border p-3 ${isDup ? "border-rose-300 bg-rose-50/50" : "border-slate-200 bg-white"}`}
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                            Thiết bị #{index + 1}
                          </span>
                          {isDup && (
                            <span className="text-xs font-medium text-rose-700">Serial bị trùng</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const nextSerials = [...serials];
                            nextSerials[index] = "";
                            setSerials(nextSerials);
                          }}
                          className="shrink-0 rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                          title="Xóa serial hoặc IMEI chính"
                        >
                          Xóa serial
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                        <label className="min-w-0">
                          <span className="mb-1 block text-[11px] font-medium text-slate-600">Serial / IMEI chính</span>
                          <input
                            type="text"
                            placeholder={`Nhập hoặc quét serial/IMEI #${index + 1}`}
                            value={val}
                            onChange={(event) => {
                              const next = [...serials];
                              next[index] = event.target.value;
                              setSerials(next);
                            }}
                            className={`w-full rounded-md border px-2.5 py-2 text-xs font-mono outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 ${
                              isDup
                                ? "border-rose-400 bg-white text-rose-900"
                                : "border-slate-200 bg-white text-slate-800"
                            }`}
                          />
                        </label>

                        <label className="min-w-0">
                          <span className="mb-1 block text-[11px] font-medium text-slate-600">Mã quản lý / barcode</span>
                          <div className="flex min-w-0 gap-2">
                            <input
                              type="text"
                              readOnly
                              aria-label={`Mã quản lý thiết bị ${index + 1}`}
                              value={unitDetails[index]?.internalBarcode || ""}
                              placeholder="Chưa tạo mã"
                              className="min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-mono text-slate-700"
                            />
                            <button
                              type="button"
                              disabled={generatingBarcodes}
                              onClick={() => void handleGenerateInternalBarcodes([index], Boolean(unitDetails[index]?.internalBarcode))}
                              className="min-w-[92px] shrink-0 rounded-md border border-cyan-200 px-2 py-2 text-[11px] font-semibold text-cyan-800 hover:bg-cyan-50 disabled:cursor-wait disabled:opacity-50"
                            >
                              {unitDetails[index]?.internalBarcode ? "Tạo lại" : "Tự sinh"}
                            </button>
                          </div>
                        </label>
                      </div>

                      <button
                        type="button"
                        aria-expanded={isImeiExpanded}
                        onClick={() => setExpandedImeiUnits((current) => ({ ...current, [index]: !current[index] }))}
                        className="mt-2 inline-flex items-center gap-1 rounded px-1 py-1 text-xs font-medium text-cyan-800 hover:bg-cyan-50"
                      >
                        {isImeiExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {isImeiExpanded ? "Thu gọn IMEI phụ" : secondaryImeiCount ? "Hiện IMEI phụ" : "Thêm IMEI phụ"}
                        {secondaryImeiCount > 0 && <span className="text-slate-500">({secondaryImeiCount}/2)</span>}
                      </button>

                      {isImeiExpanded && (
                        <div className="mt-1 grid grid-cols-1 gap-2.5 border-t border-slate-100 pt-3 sm:grid-cols-2">
                          {(["imei1", "imei2"] as const).map((field, imeiIndex) => (
                            <label key={field} className="min-w-0">
                              <span className="mb-1 block text-[11px] font-medium text-slate-600">IMEI {imeiIndex + 1} (nếu có)</span>
                              <input
                                type="text"
                                placeholder={`Nhập IMEI ${imeiIndex + 1}`}
                                value={unitDetails[index]?.[field] || ""}
                                onChange={(event) => {
                                  const next = [...unitDetails];
                                  next[index] = { ...next[index], [field]: event.target.value };
                                  setUnitDetails(next);
                                }}
                                className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs font-mono text-slate-700 outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600"
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>


            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
          <div className="text-xs text-slate-500">
            Tổng cộng: <strong className="text-slate-800">{currentQty} đơn vị</strong> ·{" "}
            Đã có IMEI: <strong className="text-cyan-700 font-bold">{filledSerials.length}</strong>
          </div>
          <div className="flex w-full items-center gap-2.5 sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:flex-none"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 rounded-md bg-cyan-700 px-5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-cyan-800 sm:flex-none"
            >
              Lưu &amp; Áp dụng IMEI
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
