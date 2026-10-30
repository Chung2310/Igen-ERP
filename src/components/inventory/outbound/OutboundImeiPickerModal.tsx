import React, { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "../../../pages/Toast";
import {
  inventorySerialService,
  type InventorySerialUnit,
} from "../../../services/inventorySerialService";

export interface OutboundImeiPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouseId: string;
  warehouseName?: string;
  productId?: string;
  sku: string;
  productName: string;
  requiredCount: number;
  initialSelectedIdentifiers: string[];
  onConfirm: (selectedIdentifiers: string[], selectedSerialNumbers: string[]) => void;
}

export function OutboundImeiPickerModal({
  isOpen,
  onClose,
  warehouseId,
  warehouseName,
  productId,
  sku,
  productName,
  requiredCount,
  initialSelectedIdentifiers,
  onConfirm,
}: OutboundImeiPickerModalProps) {
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<InventorySerialUnit[]>([]);
  const [selectedIdentifiers, setSelectedIdentifiers] = useState<string[]>(initialSelectedIdentifiers);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync initialSelected
  useEffect(() => {
    setSelectedIdentifiers(initialSelectedIdentifiers);
  }, [initialSelectedIdentifiers, isOpen]);

  // Load available units in the warehouse
  useEffect(() => {
    if (!isOpen || !warehouseId || !sku) return;

    let active = true;
    const loadUnits = async () => {
      setLoading(true);
      try {
        // Tải cả danh sách in_stock lẫn các barcode đã lưu từ trước (nếu đang sửa phiếu)
        const [availableRes, savedRes] = await Promise.all([
          inventorySerialService.list({
            warehouseId,
            sku,
            status: "in_stock",
            limit: 200,
          }),
          initialSelectedIdentifiers.length > 0
            ? inventorySerialService.list({
                barcodes: initialSelectedIdentifiers,
                limit: 100,
              })
            : Promise.resolve({ items: [] }),
        ]);

        if (!active) return;

        // Kết hợp 2 nguồn, loại trừ trùng lặp
        const map = new Map<string, InventorySerialUnit>();
        for (const item of availableRes.items) {
          map.set(item.normalizedInternalBarcode || item.internalBarcode, item);
        }
        for (const item of savedRes.items) {
          map.set(item.normalizedInternalBarcode || item.internalBarcode, item);
        }

        setUnits(Array.from(map.values()));
      } catch (err: any) {
        if (active) {
          toast.error(err?.message || "Không thể tải danh sách IMEI từ kho.");
          setUnits([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadUnits();
    return () => {
      active = false;
    };
  }, [isOpen, warehouseId, sku, initialSelectedIdentifiers]);

  // Focus ô tìm kiếm khi mở modal
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const queryNormalized = searchQuery.trim().toLowerCase();

  // Danh sách máy sau khi lọc
  const filteredUnits = useMemo(() => {
    if (!queryNormalized) return units;
    return units.filter((u) => {
      const imei = (u.serialNumber || "").toLowerCase();
      const barcode = (u.internalBarcode || "").toLowerCase();
      return imei.includes(queryNormalized) || barcode.includes(queryNormalized);
    });
  }, [units, queryNormalized]);

  // Đếm tiến độ
  const selectedCount = selectedIdentifiers.length;
  const isFulfilled = selectedCount === requiredCount;
  const isOver = selectedCount > requiredCount;

  // Toggle chọn một đơn vị
  const toggleSelect = (identifier: string) => {
    if (selectedIdentifiers.includes(identifier)) {
      setSelectedIdentifiers((prev) => prev.filter((id) => id !== identifier));
    } else {
      if (selectedCount >= requiredCount) {
        toast.error(`Đã đủ ${requiredCount} máy. Hãy bỏ chọn máy khác trước.`);
        return;
      }
      setSelectedIdentifiers((prev) => [...prev, identifier]);
    }
  };

  // Quét hoặc gõ Enter trong ô tìm kiếm
  const handleKeyDownSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const query = searchQuery.trim().toUpperCase();
      if (!query) return;

      const matched = units.find(
        (u) =>
          u.normalizedInternalBarcode === query ||
          (u.serialNumber || "").toUpperCase() === query ||
          (u.internalBarcode || "").toUpperCase() === query
      );

      if (matched) {
        const identifier = matched.normalizedInternalBarcode || matched.internalBarcode;
        if (selectedIdentifiers.includes(identifier)) {
          toast.error(`Mã ${matched.serialNumber || identifier} đã được chọn trước đó.`);
        } else if (selectedCount >= requiredCount) {
          toast.error(`Đã chọn đủ ${requiredCount} máy.`);
        } else {
          setSelectedIdentifiers((prev) => [...prev, identifier]);
          toast.success(`Đã quét chọn: ${matched.serialNumber || identifier}`);
          setSearchQuery("");
        }
      } else {
        toast.error(`Không tìm thấy IMEI / mã vạch "${query}" trong kho này.`);
      }
    }
  };

  // Chọn nhanh N máy đầu tiên còn trống
  const handleSelectFirstN = () => {
    const needed = requiredCount - selectedCount;
    if (needed <= 0) return;

    const unselected = units.filter(
      (u) => !selectedIdentifiers.includes(u.normalizedInternalBarcode || u.internalBarcode)
    );
    const toPick = unselected.slice(0, needed).map((u) => u.normalizedInternalBarcode || u.internalBarcode);

    if (toPick.length === 0) {
      toast.error("Không còn máy nào chưa được chọn trong kho.");
      return;
    }

    setSelectedIdentifiers((prev) => [...prev, ...toPick]);
    toast.success(`Đã tự động chọn thêm ${toPick.length} máy.`);
  };

  // Bỏ chọn tất cả
  const handleClearAll = () => {
    setSelectedIdentifiers([]);
  };

  // Xác nhận lựa chọn
  const handleConfirm = () => {
    if (selectedCount !== requiredCount) {
      toast.error(`Vui lòng chọn đúng ${requiredCount} máy (hiện đang chọn ${selectedCount} máy).`);
      return;
    }

    // Map ra danh sách serialNumbers tương ứng
    const serialMap = new Map<string, string>();
    for (const u of units) {
      const key = u.normalizedInternalBarcode || u.internalBarcode;
      if (u.serialNumber) {
        serialMap.set(key, u.serialNumber);
      }
    }

    const serials = selectedIdentifiers.map((id) => serialMap.get(id) || id);

    onConfirm(selectedIdentifiers, serials);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Chọn IMEI / Serial xuất kho</h3>
              <span className="rounded-md bg-cyan-100 px-2 py-0.5 text-xs font-semibold text-cyan-800 font-mono">
                {sku}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {productName} · Kho xuất: <strong className="text-slate-700">{warehouseName || warehouseId}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                isFulfilled
                  ? "bg-emerald-100 text-emerald-800"
                  : isOver
                  ? "bg-rose-100 text-rose-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              Đã chọn: {selectedCount} / {requiredCount} máy
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>

        {/* Toolbar & Search */}
        <div className="border-b border-slate-100 p-4 space-y-3 bg-white">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDownSearch}
                placeholder="Quét mã vạch hoặc nhập IMEI (bấm Enter để chọn ngay)..."
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-cyan-600 focus:bg-white focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSelectFirstN}
                disabled={selectedCount >= requiredCount || units.length === 0}
                className="rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              >
                Chọn nhanh {Math.max(0, requiredCount - selectedCount)} máy
              </button>
              {selectedCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Bỏ chọn tất cả
                </button>
              )}
            </div>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>
              Tổng số máy khả dụng trong kho: <strong className="text-slate-700">{units.length}</strong>
              {queryNormalized && ` · Khớp tìm kiếm: ${filteredUnits.length}`}
            </span>
            <span className="italic">Gợi ý: Dùng máy quét barcode quét trực tiếp vào ô tìm kiếm</span>
          </div>
        </div>

        {/* List of Units */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-96 min-h-[220px]">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Đang tải danh sách IMEI từ kho...
            </div>
          ) : filteredUnits.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              {units.length === 0
                ? "Kho này hiện không có máy nào thuộc SKU này sẵn sàng để xuất."
                : "Không tìm thấy IMEI / mã vạch phù hợp với từ khóa tìm kiếm."}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredUnits.map((unit, index) => {
                const identifier = unit.normalizedInternalBarcode || unit.internalBarcode;
                const isChecked = selectedIdentifiers.includes(identifier);
                const isDisabled = !isChecked && selectedCount >= requiredCount;

                return (
                  <label
                    key={unit._id || identifier || index}
                    className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                      isChecked
                        ? "border-cyan-400 bg-cyan-50/70"
                        : isDisabled
                        ? "border-slate-100 bg-slate-50/50 opacity-40 cursor-not-allowed"
                        : "border-slate-200 bg-white hover:border-cyan-200 cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={() => toggleSelect(identifier)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-600 accent-cyan-700"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-xs font-bold text-slate-800 truncate">
                          {unit.serialNumber || identifier}
                        </span>
                        {isChecked && (
                          <span className="text-[10px] font-semibold text-cyan-800 bg-cyan-100 rounded px-1.5 py-0.5">
                            Đã chọn
                          </span>
                        )}
                      </div>
                      {unit.internalBarcode && unit.internalBarcode !== unit.serialNumber && (
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          Mã NB: {unit.internalBarcode}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Nhập ngày: {new Date(unit.createdAt).toLocaleDateString("vi-VN")}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <div className="text-xs text-slate-600">
            {isFulfilled ? (
              <span className="font-semibold text-emerald-700">
                Đã chọn đủ {requiredCount} máy theo yêu cầu.
              </span>
            ) : isOver ? (
              <span className="font-semibold text-rose-700">
                Đang chọn vượt {selectedCount - requiredCount} máy.
              </span>
            ) : (
              <span className="text-slate-600">
                Còn thiếu <strong>{requiredCount - selectedCount}</strong> máy để hoàn tất dòng này.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!isFulfilled}
              className="rounded-lg bg-cyan-700 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-cyan-800 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              Xác nhận ({selectedCount}/{requiredCount})
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
