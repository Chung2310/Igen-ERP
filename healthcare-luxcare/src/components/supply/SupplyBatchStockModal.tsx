import { SupplyLinePicker } from "./SupplyLinePicker";
import { canIssueSupply } from "../../../shared/supply-stock";
import React, { useState, useEffect, useRef } from "react";
import {
  X,
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  Trash2,
  Package,
  Building2,
  Warehouse as WarehouseIcon,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Loader2,
} from "lucide-react";
import type { SupplyItem, BatchStockPayload, SupplyTransactionDocument } from "../../types/supply";
import type { SupplierRecord } from "../../types/supplier";
import type { WarehouseRecord } from "../../types/warehouse";
import type { DepartmentRecord } from "../../services/departmentService";
import { toast } from "../../pages/Toast";

interface LineItemState {
  id: string; // unique row id for React key
  supplyId: string;
  quantity: number;
  batchNumber: string;
  expiryDate: string;
  unitPrice: number;
  notes: string;
}

interface Props {
  isOpen: boolean;
  type: "in" | "out" | null;
  initialSupply?: SupplyItem | null;
  initialDraft?: SupplyTransactionDocument | null;
  suppliesList: SupplyItem[];
  suppliersList?: SupplierRecord[];
  warehousesList?: WarehouseRecord[];
  departmentsList?: DepartmentRecord[];
  actionLoading: boolean;
  onClose: () => void;
  onSubmit: (payload: BatchStockPayload) => Promise<void>;
  onSaveDraft: (payload: BatchStockPayload) => Promise<void>;
}

export const SupplyBatchStockModal: React.FC<Props> = ({
  isOpen,
  type,
  initialSupply,
  initialDraft,
  suppliesList = [],
  suppliersList = [],
  warehousesList = [],
  departmentsList = [],
  actionLoading,
  onClose,
  onSubmit,
  onSaveDraft,
}) => {
  const formRef = useRef<HTMLFormElement>(null);
  const submitIntentRef = useRef<"draft" | "complete">("complete");
  const [batchCode, setBatchCode] = useState("");
  const [voucherDate, setVoucherDate] = useState("");
  const [reason, setReason] = useState("");
  const [supplier, setSupplier] = useState("");
  const [warehouseLocation, setWarehouseLocation] = useState("");
  const [recipientDepartment, setRecipientDepartment] = useState("");
  const [lines, setLines] = useState<LineItemState[]>([]);

  // Generate unique voucher code
  const generateVoucherCode = (txType: "in" | "out") => {
    const d = new Date();
    const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${txType === "in" ? "PNK" : "PXK"}-${ymd}-${rand}`;
  };

  useEffect(() => {
    if (isOpen && type) {
      document.body.style.overflow = "hidden";
      if (initialDraft) {
        setBatchCode(initialDraft.batchCode || "");
        setVoucherDate(new Date(initialDraft.createdAt).toISOString().slice(0, 10));
        setReason(initialDraft.reason || "");
        setSupplier(initialDraft.supplier || "");
        setWarehouseLocation(initialDraft.warehouseLocation || "");
        setRecipientDepartment(initialDraft.recipientDepartment || "");
        setLines(
          initialDraft.items.map((item, index) => ({
            id: String(item._id || `draft-line-${index}`),
            supplyId: item.supplyId,
            quantity: item.quantity,
            batchNumber: item.batchNumber || "",
            expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().slice(0, 10) : "",
            unitPrice: item.unitPrice || 0,
            notes: "",
          })),
        );
      } else {
        const code = generateVoucherCode(type);
        setBatchCode(code);
        setVoucherDate(new Date().toISOString().slice(0, 10));
        setReason(type === "in" ? "Nhập thêm hàng định kỳ vào kho" : "Cấp phát sử dụng cho khoa phòng");
        setSupplier(initialSupply?.supplier || suppliersList[0]?.name || "");
        setWarehouseLocation(initialSupply?.warehouseLocation || warehousesList[0]?.name || "");
        setRecipientDepartment("");

        // Initialize first item
        const defaultSupply = initialSupply || (suppliesList.length > 0 ? suppliesList[0] : null);
        if (defaultSupply) {
          setLines([
            {
              id: `line-${Date.now()}-1`,
              supplyId: defaultSupply._id,
              quantity: 1,
              batchNumber: defaultSupply.batchNumber || "",
              expiryDate: defaultSupply.expiryDate ? new Date(defaultSupply.expiryDate).toISOString().slice(0, 10) : "",
              unitPrice: defaultSupply.unitPrice || 0,
              notes: "",
            },
          ]);
        } else {
          setLines([]);
        }
      }
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, type, initialSupply, initialDraft]);

  if (!isOpen || !type) return null;

  const isIn = type === "in";

  const handleAddLine = () => {
    // Find a supply that is not yet added if possible, or fallback to first
    const usedIds = new Set(lines.map((l) => l.supplyId));
    const nextSupply = suppliesList.find((s) => !usedIds.has(s._id)) || suppliesList[0];
    if (!nextSupply) {
      toast.error("Không còn vật tư nào trong danh mục.");
      return;
    }

    setLines((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        supplyId: nextSupply._id,
        quantity: 1,
        batchNumber: nextSupply.batchNumber || "",
        expiryDate: nextSupply.expiryDate ? new Date(nextSupply.expiryDate).toISOString().slice(0, 10) : "",
        unitPrice: nextSupply.unitPrice || 0,
        notes: "",
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) {
      toast.error("Phiếu phải có ít nhất 1 mặt hàng.");
      return;
    }
    setLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleLineSupplyChange = (index: number, newSupplyId: string) => {
    const targetSupply = suppliesList.find((s) => s._id === newSupplyId);
    if (!targetSupply) return;

    setLines((prev) =>
      prev.map((line, idx) => {
        if (idx !== index) return line;
        return {
          ...line,
          supplyId: targetSupply._id,
          batchNumber: targetSupply.batchNumber || "",
          expiryDate: targetSupply.expiryDate ? new Date(targetSupply.expiryDate).toISOString().slice(0, 10) : "",
          unitPrice: targetSupply.unitPrice || 0,
        };
      }),
    );
  };

  const handleLineFieldChange = (index: number, field: keyof LineItemState, value: any) => {
    setLines((prev) =>
      prev.map((line, idx) => {
        if (idx !== index) return line;
        return { ...line, [field]: value };
      }),
    );
  };

  // Calculations
  const totalQuantity = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
  const totalEstimatedValue = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);

  // Check if any line has stock-out error
  const hasStockOutError =
    !isIn &&
    lines.some((line) => {
      const sup = suppliesList.find((s) => s._id === line.supplyId);
      return (
        !sup ||
        !canIssueSupply(sup) ||
        lines.filter((l) => l.supplyId === line.supplyId).reduce((total, l) => total + Number(l.quantity), 0) >
          (sup.availableQuantity ?? sup.quantity)
      );
    });

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitIntent = submitIntentRef.current;
    submitIntentRef.current = "complete";

    if (!reason.trim()) {
      toast.error("Vui lòng nhập lý do xuất / nhập kho.");
      return;
    }

    if (
      !isIn &&
      !departmentsList.some((department) => department.isActive && department.name === recipientDepartment)
    ) {
      toast.error("Vui lòng chọn khoa/phòng đang hoạt động từ danh sách.");
      return;
    }

    if (lines.length === 0) {
      toast.error("Phiếu cần ít nhất 1 mặt hàng.");
      return;
    }

    // Validate quantities & duplicate checks
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const sup = suppliesList.find((s) => s._id === line.supplyId);
      if (!sup) {
        toast.error(`Dòng ${i + 1}: Vật tư không hợp lệ.`);
        return;
      }
      if (!isIn && !canIssueSupply(sup)) {
        toast.error("Vật tư hết hạn hoặc chưa xác minh hạn dùng, không được xuất dùng.");
        return;
      }
      if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
        toast.error(`Dòng ${i + 1} (${sup.name}): Số lượng phải lớn hơn 0.`);
        return;
      }
      if (!isIn && line.quantity > (sup.availableQuantity ?? sup.quantity)) {
        toast.error(
          `Dòng ${i + 1} (${sup.name}): Số lượng xuất (${line.quantity}) vượt quá tồn kho hiện có (${sup.availableQuantity ?? sup.quantity} ${sup.unit}).`,
        );
        return;
      }
    }

    const payload: BatchStockPayload = {
      type,
      batchCode: batchCode.trim(),
      reason: reason.trim(),
      supplier: isIn ? supplier.trim() : undefined,
      warehouseLocation: warehouseLocation.trim(),
      recipientDepartment: !isIn ? recipientDepartment.trim() : undefined,
      items: lines.map((l) => ({
        supplyId: l.supplyId,
        quantity: Number(l.quantity),
        batchNumber: l.batchNumber ? l.batchNumber.trim() : undefined,
        expiryDate: l.expiryDate ? l.expiryDate : undefined,
        unitPrice: Number(l.unitPrice),
        notes: l.notes ? l.notes.trim() : undefined,
      })),
    };

    if (submitIntent === "draft") await onSaveDraft(payload);
    else await onSubmit(payload);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`p-5 md:px-6 border-b flex items-center justify-between shrink-0 ${
            isIn
              ? "bg-gradient-to-r from-emerald-50/70 to-teal-50/40 border-emerald-100"
              : "bg-gradient-to-r from-amber-50/70 to-orange-50/40 border-amber-100"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                isIn ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"
              }`}
            >
              {isIn ? <ArrowDownRight className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900">
                  {initialDraft
                    ? isIn
                      ? "Cập nhật Phiếu Nhập Kho"
                      : "Cập nhật Phiếu Xuất Kho"
                    : isIn
                      ? "Lập Phiếu Nhập Kho Theo Lô"
                      : "Lập Phiếu Xuất Kho Theo Lô"}
                </h2>
                <span className="px-2.5 py-0.5 rounded-lg bg-white/90 border border-slate-200 text-slate-700 font-mono text-xs font-bold shadow-2xs">
                  {batchCode}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isIn
                  ? "Nhập đồng thời nhiều mặt hàng vào kho, cập nhật số lô, HSD và giá vốn"
                  : "Cấp phát xuất dùng nhiều mặt hàng cho khoa/phòng trong một chứng từ"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white/80 rounded-xl transition cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form ref={formRef} onSubmit={handleSubmitForm} className="flex-1 overflow-y-auto flex flex-col min-h-0">
          <div className="p-5 md:p-6 space-y-5 flex-1">
            {/* Voucher Header Info Card */}
            <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-3.5">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-4 h-4 text-slate-400" />
                Thông tin chung chứng từ
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                {/* Mã phiếu */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mã phiếu / Lô <span className="text-rose-500 font-bold ml-0.5">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={batchCode}
                    onChange={(e) => setBatchCode(e.target.value.toUpperCase())}
                    placeholder="PNK-YYYYMMDD-XXXX"
                    className="h-12 w-full min-w-0 px-3 py-2 text-base bg-white border border-slate-200 rounded-xl font-mono text-slate-800 focus:outline-emerald-600"
                  />
                </div>

                {/* Ngày lập phiếu */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Ngày chứng từ <span className="text-rose-500 font-bold ml-0.5">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    className="h-12 w-full min-w-0 px-3 py-2 text-base bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-emerald-600"
                  />
                </div>

                {/* Nếu là nhập: Nhà cung cấp. Nếu là xuất: Khoa phòng nhận */}
                {isIn ? (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nhà cung cấp</label>
                    {suppliersList.length > 0 ? (
                      <select
                        value={supplier}
                        onChange={(e) => setSupplier(e.target.value)}
                        className="h-12 w-full min-w-0 px-3 py-2 text-base bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-emerald-600"
                      >
                        <option value="">-- Chọn nhà cung cấp --</option>
                        {suppliersList.map((sup) => (
                          <option key={sup._id} value={sup.name}>
                            {sup.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={supplier}
                        onChange={(e) => setSupplier(e.target.value)}
                        placeholder="Tên nhà cung cấp..."
                        className="h-12 w-full min-w-0 px-3 py-2 text-base bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-emerald-600"
                      />
                    )}
                  </div>
                ) : (
                  <div>
                    <label htmlFor="recipient-department" className="block font-semibold text-slate-700 mb-1">
                      Khoa / Phòng nhận <span className="text-rose-500 font-bold ml-0.5">*</span>
                    </label>
                    <select
                      id="recipient-department"
                      required
                      value={recipientDepartment}
                      onChange={(e) => setRecipientDepartment(e.target.value)}
                      className="h-12 w-full min-w-0 px-3 py-2 text-base bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-amber-600 font-medium"
                    >
                      <option value="">-- Chọn khoa / phòng nhận --</option>
                      {departmentsList.map((department) => (
                        <option key={department._id} value={department.name}>
                          {department.code} · {department.name}
                        </option>
                      ))}
                    </select>
                    {!departmentsList.length && (
                      <p className="mt-1 text-xs text-amber-700">
                        Chưa có phòng ban đang hoạt động. Hãy tạo phòng ban trước khi xuất kho.
                      </p>
                    )}
                  </div>
                )}

                {/* Kho lưu trữ */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isIn ? "Kho tiếp nhận" : "Kho xuất hàng"}
                  </label>
                  {warehousesList.length > 0 ? (
                    <select
                      value={warehouseLocation}
                      onChange={(e) => setWarehouseLocation(e.target.value)}
                      className="h-12 w-full min-w-0 px-3 py-2 text-base bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-emerald-600"
                    >
                      <option value="">-- Chọn kho --</option>
                      {warehousesList.map((wh) => (
                        <option key={wh._id} value={wh.name}>
                          {wh.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={warehouseLocation}
                      onChange={(e) => setWarehouseLocation(e.target.value)}
                      placeholder="VD: Kho Dược 1, Kho Tiêu Hao..."
                      className="h-12 w-full min-w-0 px-3 py-2 text-base bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-emerald-600"
                    />
                  )}
                </div>

                {/* Lý do xuất / nhập */}
                <div className="sm:col-span-2 lg:col-span-4">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Lý do / Mục đích chứng từ <span className="text-rose-500 font-bold ml-0.5">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={
                      isIn
                        ? "VD: Nhập định kỳ theo hợp đồng cung ứng số 12/2026..."
                        : "VD: Cấp phát vật tư tiêu hao đầu tuần cho Khoa Cấp Cứu..."
                    }
                    className="h-12 w-full min-w-0 px-3.5 py-2 text-base bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-emerald-600"
                  />
                </div>
              </div>
            </div>

            {/* Line Items Table Card */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">Danh sách sản phẩm trong phiếu</h4>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                    {lines.length} mặt hàng
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleAddLine}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm sản phẩm
                </button>
              </div>

              <div className="space-y-4">
                {lines.map((line, index) => {
                  const selectedSup = suppliesList.find((s) => s._id === line.supplyId);
                  const isOverStock =
                    !isIn &&
                    selectedSup &&
                    Number(line.quantity) > (selectedSup.availableQuantity ?? selectedSup.quantity);
                  const subtotal = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
                  const fieldClass =
                    "h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-base font-medium tabular-nums text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
                  return (
                    <fieldset
                      key={line.id}
                      disabled={actionLoading}
                      className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5"
                    >
                      <legend className="px-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Vật tư {index + 1}
                      </legend>
                      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="min-w-0">
                          <span className="mb-2 block text-sm font-semibold text-slate-700">
                            Tên và mã vật tư <span className="text-rose-500">*</span>
                          </span>
                          <SupplyLinePicker
                            items={suppliesList}
                            value={line.supplyId}
                            onChange={(id) => handleLineSupplyChange(index, id)}
                            label={`Vật tư dòng ${index + 1}`}
                            disabled={actionLoading}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-4 sm:pt-6">
                          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <span className="block text-xs font-medium text-slate-500">
                              {isIn ? "Tồn kho hiện có" : "Tồn khả dụng"}
                            </span>
                            <span className="mt-1 block whitespace-nowrap text-base font-semibold tabular-nums text-slate-800">
                              {(
                                (isIn
                                  ? selectedSup?.quantity
                                  : (selectedSup?.availableQuantity ?? selectedSup?.quantity)) ?? 0
                              ).toLocaleString("vi-VN")}{" "}
                              <span className="text-sm font-normal text-slate-500">{selectedSup?.unit}</span>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(index)}
                            disabled={lines.length <= 1}
                            aria-label={`Xóa vật tư dòng ${index + 1}`}
                            className="rounded-xl p-3 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                            title="Xóa mặt hàng này khỏi phiếu"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                      <div className={`grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 ${isIn ? "lg:grid-cols-4" : ""}`}>
                        <label className="block min-w-0 space-y-2 text-sm font-semibold text-slate-700">
                          <span>
                            Số lượng {selectedSup?.unit ? `(${selectedSup.unit})` : ""}{" "}
                            <span className="text-rose-500">*</span>
                          </span>
                          <input
                            aria-label={`Số lượng dòng ${index + 1}`}
                            type="number"
                            min={1}
                            step={1}
                            required
                            value={line.quantity}
                            onChange={(e) =>
                              handleLineFieldChange(index, "quantity", Math.max(1, parseInt(e.target.value) || 1))
                            }
                            className={fieldClass + (isOverStock ? " border-rose-400 text-rose-700" : "")}
                          />
                          {isOverStock && (
                            <span className="block text-xs font-medium text-rose-600">
                              Vượt tồn ({selectedSup?.quantity})
                            </span>
                          )}
                        </label>
                        {isIn && (
                          <>
                            <label className="block min-w-0 space-y-2 text-sm font-semibold text-slate-700">
                              <span>Số lô</span>
                              <input
                                aria-label={`Số lô dòng ${index + 1}`}
                                type="text"
                                value={line.batchNumber}
                                onChange={(e) => handleLineFieldChange(index, "batchNumber", e.target.value)}
                                placeholder="VD: LOT2026-01"
                                className={fieldClass}
                              />
                            </label>
                            <label className="block min-w-0 space-y-2 text-sm font-semibold text-slate-700">
                              <span>Hạn sử dụng</span>
                              <input
                                aria-label={`Hạn sử dụng dòng ${index + 1}`}
                                type="date"
                                value={line.expiryDate}
                                onChange={(e) => handleLineFieldChange(index, "expiryDate", e.target.value)}
                                className={fieldClass}
                              />
                            </label>
                            <label className="block min-w-0 space-y-2 text-sm font-semibold text-slate-700">
                              <span>Đơn giá (đ)</span>
                              <input
                                aria-label={`Đơn giá dòng ${index + 1}`}
                                type="number"
                                min={0}
                                value={line.unitPrice}
                                onChange={(e) =>
                                  handleLineFieldChange(index, "unitPrice", Math.max(0, parseInt(e.target.value) || 0))
                                }
                                className={fieldClass}
                              />
                            </label>
                          </>
                        )}
                      </div>
                      {isIn && (
                        <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3 text-sm">
                          <span className="text-slate-500">Thành tiền</span>
                          <strong className="text-lg tabular-nums text-emerald-700">
                            {subtotal.toLocaleString("vi-VN")} đ
                          </strong>
                        </div>
                      )}
                    </fieldset>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Summary Bar & Action Buttons (Cố định ở cuối trang modal) */}
          <div className="p-4 md:px-6 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
            {/* Summary badges */}
            <div className="flex items-center gap-3 flex-wrap text-xs text-slate-600 w-full sm:w-auto">
              <span className="font-medium">
                Tổng cộng: <strong className="text-slate-900">{lines.length}</strong> mặt hàng
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-medium">
                Tổng số lượng: <strong className="text-slate-900">{totalQuantity}</strong> đơn vị
              </span>
              {isIn && totalEstimatedValue > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="font-medium">
                    Tổng giá trị:{" "}
                    <strong className="text-emerald-700">{totalEstimatedValue.toLocaleString("vi-VN")} đ</strong>
                  </span>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={actionLoading}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                onClick={() => {
                  submitIntentRef.current = "draft";
                  formRef.current?.requestSubmit();
                }}
                disabled={actionLoading || lines.length === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-100 disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {initialDraft ? "Cập nhật nháp" : "Lưu nháp"}
              </button>

              <button
                type="submit"
                onClick={() => {
                  submitIntentRef.current = "complete";
                }}
                disabled={actionLoading || hasStockOutError || lines.length === 0}
                className={`inline-flex items-center gap-2 px-6 py-2 rounded-xl text-white text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer ${
                  isIn
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                    : "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                }`}
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isIn ? "Hoàn tất Nhập kho theo lô" : "Hoàn tất Xuất kho theo lô"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
