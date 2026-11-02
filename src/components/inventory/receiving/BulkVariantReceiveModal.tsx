import React, { useMemo, useState } from "react";
import { toast } from "../../../pages/Toast";
import type { CatalogProduct, CatalogProductDetail, ProductVariant } from "../../../services/productCatalogService";
import { trackingLabels } from "../catalog/catalogConstants";
import { NumberInput } from "../catalog/catalogUi";

export interface SelectedReceiveVariant {
  variant: ProductVariant;
  quantity: number;
  unitCost: number;
  supplierWarrantyMonths?: number;
}

interface BulkVariantReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: CatalogProduct;
  productDetail?: CatalogProductDetail;
  existingVariantIds: string[];
  onConfirm: (selected: SelectedReceiveVariant[]) => void;
}

const ATTRIBUTE_LABELS: Record<string, string> = {
  STORAGE: "Dung lượng",
  CONDITION: "Tình trạng",
  COLOR: "Màu sắc",
  ORIGIN: "Xuất xứ / Bản",
  RAM: "RAM",
  WATTAGE: "Công suất",
};

// Smart attribute group resolver from code or value
const resolveGroupCode = (ov: { code?: string; value?: string }): string => {
  const c = (ov.code || "").trim().toUpperCase();
  if (c && c !== "OTHER" && c !== "OPT" && c !== "OPTION") {
    return c;
  }
  const val = (ov.value || "").trim().toLowerCase();
  if (val.includes("gb") || val.includes("tb")) return "STORAGE";
  if (
    val.includes("seal") ||
    val.includes("active") ||
    val.includes("99%") ||
    val.includes("98%") ||
    val.includes("95%") ||
    val.includes("cũ") ||
    val.includes("mới")
  ) {
    return "CONDITION";
  }
  if (val.includes("vn/a") || val.includes("ll/a") || val.includes("za/a") || val.includes("ja/a")) {
    return "ORIGIN";
  }
  return "COLOR";
};

// Sort storage size ascending (64GB -> 128GB -> 256GB -> 512GB -> 1TB)
const sortStorageValues = (a: string, b: string): number => {
  const parseBytes = (val: string) => {
    const num = parseFloat(val) || 0;
    if (val.toUpperCase().includes("TB")) return num * 1024;
    return num;
  };
  return parseBytes(a) - parseBytes(b);
};

// Sort condition priority from brand-new to used
const conditionOrder = ["mới 100% nguyên seal", "mới 100% active", "like-new 99%", "cũ 98%", "cũ 95%"];
const sortConditionValues = (a: string, b: string): number => {
  const lowA = a.toLowerCase();
  const lowB = b.toLowerCase();
  const idxA = conditionOrder.findIndex((k) => lowA.includes(k));
  const idxB = conditionOrder.findIndex((k) => lowB.includes(k));
  if (idxA >= 0 && idxB >= 0) return idxA - idxB;
  if (idxA >= 0) return -1;
  if (idxB >= 0) return 1;
  return a.localeCompare(b, "vi-VN");
};

interface AttributeGroup {
  code: string;
  name: string;
  values: string[];
}

export function BulkVariantReceiveModal({
  isOpen,
  onClose,
  product,
  productDetail,
  existingVariantIds,
  onConfirm,
}: BulkVariantReceiveModalProps) {
  if (!isOpen) return null;

  const variants = useMemo(() => {
    return (productDetail?.variants || []).filter((v) => v.status === "active");
  }, [productDetail]);

  // Set of checked variant IDs for batch application
  const [checkedVariantIds, setCheckedVariantIds] = useState<Set<string>>(new Set());
  // Map of variantId -> quantity
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  // Map of variantId -> unitCost
  const [unitCosts, setUnitCosts] = useState<Record<string, number>>({});
  // Map of variantId -> supplierWarrantyMonths
  const [warranties, setWarranties] = useState<Record<string, number>>({});

  // Multi-attribute filter state: groupCode -> array of selected values
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string[]>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(true);

  // Batch action input values
  const [batchQuantity, setBatchQuantity] = useState<number>(10);
  const [batchUnitCost, setBatchUnitCost] = useState<number>(0);
  const [batchWarrantyMonths, setBatchWarrantyMonths] = useState<number>(12);

  // Group variants by attributes (e.g. Dung lượng, Tình trạng, Màu sắc...)
  const attributeGroups = useMemo<AttributeGroup[]>(() => {
    const groupMap = new Map<string, Set<string>>();

    for (const v of variants) {
      for (const ov of v.optionValues || []) {
        if (!ov.value) continue;
        const groupCode = resolveGroupCode(ov);
        if (!groupMap.has(groupCode)) {
          groupMap.set(groupCode, new Set());
        }
        groupMap.get(groupCode)!.add(ov.value.trim());
      }
    }

    const result: AttributeGroup[] = [];
    for (const [code, valSet] of groupMap.entries()) {
      const values = Array.from(valSet);
      if (code === "STORAGE") {
        values.sort(sortStorageValues);
      } else if (code === "CONDITION") {
        values.sort(sortConditionValues);
      } else {
        values.sort((a, b) => a.localeCompare(b, "vi-VN"));
      }

      result.push({
        code,
        name: ATTRIBUTE_LABELS[code] || code,
        values,
      });
    }

    // Display order: Storage -> Condition -> Color -> Origin -> Others
    const priority = ["STORAGE", "CONDITION", "COLOR", "ORIGIN", "RAM", "WATTAGE"];
    result.sort((a, b) => {
      const idxA = priority.indexOf(a.code);
      const idxB = priority.indexOf(b.code);
      if (idxA >= 0 && idxB >= 0) return idxA - idxB;
      if (idxA >= 0) return -1;
      if (idxB >= 0) return 1;
      return a.name.localeCompare(b.name, "vi-VN");
    });

    return result;
  }, [variants]);

  // Toggle multi-select attribute value
  const handleToggleAttribute = (groupCode: string, value: string) => {
    setSelectedAttributes((current) => {
      const currentList = current[groupCode] || [];
      const exists = currentList.includes(value);
      const nextList = exists ? currentList.filter((v) => v !== value) : [...currentList, value];

      const next = { ...current };
      if (nextList.length === 0) {
        delete next[groupCode];
      } else {
        next[groupCode] = nextList;
      }
      return next;
    });
  };

  // Clear single group filter
  const handleClearGroup = (groupCode: string) => {
    setSelectedAttributes((current) => {
      const next = { ...current };
      delete next[groupCode];
      return next;
    });
  };

  // Clear all filters
  const handleClearAllFilters = () => {
    setSelectedAttributes({});
    setSearchQuery("");
  };

  const totalActiveFilterCount = useMemo(() => {
    return Object.values(selectedAttributes).reduce((acc, curr) => acc + curr.length, 0);
  }, [selectedAttributes]);

  // Filtered variants based on multi-dimension attributes and search text
  const filteredVariants = useMemo(() => {
    const activeGroupCodes = Object.keys(selectedAttributes).filter(
      (code) => selectedAttributes[code] && selectedAttributes[code].length > 0
    );
    const q = searchQuery.trim().toLowerCase();

    return variants.filter((v) => {
      // 1. Multi-attribute cross-dimension filter (OR in same group, AND between groups)
      for (const groupCode of activeGroupCodes) {
        const allowedValues = selectedAttributes[groupCode];
        const vValuesInGroup = (v.optionValues || [])
          .filter((ov) => resolveGroupCode(ov) === groupCode)
          .map((ov) => ov.value.trim());

        const hasMatch = vValuesInGroup.some((val) => allowedValues.includes(val));
        if (!hasMatch) {
          return false;
        }
      }

      // 2. Free text search
      if (q) {
        const matchSku = v.sku.toLowerCase().includes(q);
        const matchBarcode = v.barcode?.toLowerCase().includes(q);
        const matchName = v.displayName?.toLowerCase().includes(q);
        const matchOpts = (v.optionValues || []).some((opt) => opt.value.toLowerCase().includes(q));
        if (!matchSku && !matchBarcode && !matchName && !matchOpts) {
          return false;
        }
      }

      return true;
    });
  }, [variants, selectedAttributes, searchQuery]);

  // Checked count among currently filtered/visible variants
  const checkedInFiltered = useMemo(() => {
    return filteredVariants.filter((v) => checkedVariantIds.has(v._id));
  }, [filteredVariants, checkedVariantIds]);

  const isAllVisibleChecked = filteredVariants.length > 0 && checkedInFiltered.length === filteredVariants.length;
  const isSomeVisibleChecked = checkedInFiltered.length > 0 && checkedInFiltered.length < filteredVariants.length;

  // Toggle single variant checkbox (ONLY manages selection; NEVER alters quantities, unitCosts or warranties)
  const handleToggleCheck = (variantId: string) => {
    setCheckedVariantIds((current) => {
      const next = new Set(current);
      if (next.has(variantId)) {
        next.delete(variantId);
      } else {
        next.add(variantId);
      }
      return next;
    });
  };

  // Toggle header checkbox for all visible variants
  const handleToggleSelectAllVisible = () => {
    if (isAllVisibleChecked) {
      setCheckedVariantIds((current) => {
        const next = new Set(current);
        for (const v of filteredVariants) {
          next.delete(v._id);
        }
        return next;
      });
    } else {
      setCheckedVariantIds((current) => {
        const next = new Set(current);
        for (const v of filteredVariants) {
          next.add(v._id);
        }
        return next;
      });
    }
  };

  // Quick select all visible (only check boxes, preserve all existing data)
  const handleSelectAllVisible = () => {
    setCheckedVariantIds((current) => {
      const next = new Set(current);
      for (const v of filteredVariants) {
        next.add(v._id);
      }
      return next;
    });
  };

  // Uncheck all (preserve all configured quantities and prices!)
  const handleClearSelection = () => {
    setCheckedVariantIds(new Set());
  };

  // Apply batch quantity ONLY to currently selected visible variants
  const handleApplyBatchQuantity = () => {
    if (batchQuantity <= 0) {
      toast.error("Vui lòng nhập số lượng lớn hơn 0.");
      return;
    }

    const targetVariants = checkedInFiltered;
    if (targetVariants.length === 0) {
      toast.error("Vui lòng tích chọn ít nhất 1 SKU ở bảng bên dưới để áp số lượng.");
      return;
    }

    setQuantities((current) => {
      const next = { ...current };
      for (const v of targetVariants) {
        next[v._id] = batchQuantity;
      }
      return next;
    });
    toast.success(`Đã áp dụng số lượng ${batchQuantity} cho ${targetVariants.length} SKU đang chọn.`);
  };

  // Apply batch unit cost ONLY to currently selected visible variants
  const handleApplyBatchUnitCost = () => {
    if (batchUnitCost < 0) {
      toast.error("Vui lòng nhập giá nhập hợp lệ (>= 0).");
      return;
    }

    const targetVariants = checkedInFiltered;
    if (targetVariants.length === 0) {
      toast.error("Vui lòng tích chọn ít nhất 1 SKU ở bảng bên dưới để áp giá nhập.");
      return;
    }

    setUnitCosts((current) => {
      const next = { ...current };
      for (const v of targetVariants) {
        next[v._id] = batchUnitCost;
      }
      return next;
    });
    toast.success(
      `Đã áp dụng giá nhập ${batchUnitCost.toLocaleString("vi-VN")} ₫ cho ${targetVariants.length} SKU đang chọn.`
    );
  };

  // Apply batch warranty ONLY to currently selected visible variants
  const handleApplyBatchWarranty = () => {
    if (batchWarrantyMonths < 0) {
      toast.error("Vui lòng nhập số tháng bảo hành hợp lệ (>= 0).");
      return;
    }

    const targetVariants = checkedInFiltered;
    if (targetVariants.length === 0) {
      toast.error("Vui lòng tích chọn ít nhất 1 SKU ở bảng bên dưới để áp BH NCC.");
      return;
    }

    setWarranties((current) => {
      const next = { ...current };
      for (const v of targetVariants) {
        next[v._id] = batchWarrantyMonths;
      }
      return next;
    });
    toast.success(`Đã áp dụng BH NCC ${batchWarrantyMonths} tháng cho ${targetVariants.length} SKU đang chọn.`);
  };

  // All variants ready to be added into receipt: any variant with quantity > 0
  const selectedList = useMemo(() => {
    const list: SelectedReceiveVariant[] = [];
    for (const v of variants) {
      const qty = quantities[v._id] || 0;
      if (qty > 0) {
        list.push({
          variant: v,
          quantity: qty,
          unitCost: unitCosts[v._id] || 0,
          supplierWarrantyMonths: warranties[v._id] !== undefined ? warranties[v._id] : (v.supplierWarrantyMonths ?? 0),
        });
      }
    }
    return list;
  }, [variants, quantities, unitCosts, warranties]);

  const totalQuantity = useMemo(() => {
    return selectedList.reduce((acc, curr) => acc + curr.quantity, 0);
  }, [selectedList]);

  const totalAmount = useMemo(() => {
    return selectedList.reduce((acc, curr) => acc + curr.quantity * curr.unitCost, 0);
  }, [selectedList]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedList.length === 0) {
      toast.error("Chưa có SKU nào được nhập số lượng. Vui lòng nhập số lượng trước khi thêm vào phiếu.");
      return;
    }
    onConfirm(selectedList);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-2 sm:p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="flex h-[95vh] w-[98vw] max-w-[1440px] flex-col rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Header - Compact */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-2.5 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Nhập nhanh nhiều SKU theo sản phẩm
            </h3>
            <span className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-bold text-cyan-800 border border-cyan-200">
              {variants.length} SKU
            </span>
            <span className="text-slate-300">|</span>
            <p className="text-xs text-slate-600">
              Sản phẩm: <strong className="font-semibold text-slate-900">{product.name}</strong> ({product.productCode})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="text-slate-400 hover:text-slate-700 rounded p-1 hover:bg-slate-100 transition-colors text-sm font-semibold leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Toolbar & Filters - Highly Compact */}
        <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-2.5 space-y-2 shrink-0">
          {/* Main Action Bar: Search + Batch Tools + Select All */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: Quick search */}
            <div className="relative w-64 lg:w-72">
              <input
                type="text"
                placeholder="Tìm nhanh biến thể, SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white py-1 px-2.5 text-xs outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1 text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Middle: Unified Batch Actions Toolbar */}
            <div className="flex flex-wrap items-center gap-2 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-xs">
              <div className="flex items-center gap-1.5 mr-1 text-xs">
                <span className="font-semibold text-slate-700">Đang chọn:</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                    checkedInFiltered.length > 0
                      ? "bg-cyan-100 text-cyan-800 border border-cyan-200"
                      : "bg-slate-100 text-slate-500 border border-slate-200"
                  }`}
                >
                  {checkedInFiltered.length} / {filteredVariants.length} SKU
                </span>
                {checkedInFiltered.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="text-xs text-rose-600 hover:text-rose-700 font-medium underline ml-0.5 cursor-pointer"
                    title="Bỏ tích chọn để giữ nguyên giá cho nhóm này và chọn nhóm khác"
                  >
                    Bỏ chọn
                  </button>
                )}
              </div>

              <div className="h-5 w-px bg-slate-200 mx-0.5" />

              {/* SL chung */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-600 font-medium shrink-0">SL:</span>
                <NumberInput
                  value={batchQuantity}
                  onChange={(val) => setBatchQuantity(Math.max(0, val))}
                  className="w-14 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-right font-bold text-slate-900 outline-none focus:border-cyan-600"
                  placeholder="10"
                />
                <button
                  type="button"
                  onClick={handleApplyBatchQuantity}
                  className={`rounded px-2.5 py-1 text-xs font-semibold transition-all shadow-xs ${
                    checkedInFiltered.length > 0
                      ? "bg-cyan-700 hover:bg-cyan-800 text-white cursor-pointer active:scale-95"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                  }`}
                >
                  Áp SL {checkedInFiltered.length > 0 ? `(${checkedInFiltered.length})` : ""}
                </button>
              </div>

              <div className="h-5 w-px bg-slate-200 mx-0.5" />

              {/* Giá nhập */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-600 font-medium shrink-0">Giá:</span>
                <NumberInput
                  value={batchUnitCost}
                  onChange={(val) => setBatchUnitCost(Math.max(0, val))}
                  className="w-24 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-right font-bold text-slate-900 outline-none focus:border-cyan-600"
                  placeholder="0 ₫"
                />
                <button
                  type="button"
                  onClick={handleApplyBatchUnitCost}
                  className={`rounded px-2.5 py-1 text-xs font-semibold transition-all shadow-xs ${
                    checkedInFiltered.length > 0
                      ? "bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer active:scale-95"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                  }`}
                >
                  Áp giá {checkedInFiltered.length > 0 ? `(${checkedInFiltered.length})` : ""}
                </button>
              </div>

              <div className="h-5 w-px bg-slate-200 mx-0.5" />

              {/* BH NCC */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-600 font-medium shrink-0">BH:</span>
                <div className="flex items-center gap-0.5">
                  <NumberInput
                    value={batchWarrantyMonths}
                    onChange={(val) => setBatchWarrantyMonths(Math.max(0, val))}
                    className="w-12 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-right font-bold text-slate-900 outline-none focus:border-cyan-600"
                    placeholder="12"
                  />
                  <span className="text-xs text-slate-500">th</span>
                </div>
                <button
                  type="button"
                  onClick={handleApplyBatchWarranty}
                  className={`rounded px-2.5 py-1 text-xs font-semibold transition-all shadow-xs ${
                    checkedInFiltered.length > 0
                      ? "bg-blue-700 hover:bg-blue-800 text-white cursor-pointer active:scale-95"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                  }`}
                >
                  Áp BH {checkedInFiltered.length > 0 ? `(${checkedInFiltered.length})` : ""}
                </button>
              </div>
            </div>

            {/* Right: Quick Check / Uncheck all */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
              >
                Chọn tất cả ({filteredVariants.length})
              </button>
              <button
                type="button"
                onClick={handleClearSelection}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-rose-600 hover:border-rose-200 shadow-xs transition-colors cursor-pointer"
              >
                Bỏ chọn hết
              </button>
              {attributeGroups.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                  className="rounded border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-800 hover:bg-cyan-100 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>Bộ lọc thuộc tính</span>
                  <span className="text-[10px]">{isFilterExpanded ? "▲" : "▼"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Collapsible Multi-attribute dimension filters */}
          {attributeGroups.length > 0 && isFilterExpanded && (
            <div className="rounded-lg border border-slate-200 bg-white p-2 space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                    Lọc nhanh theo nhóm thuộc tính:
                  </span>
                  {(totalActiveFilterCount > 0 || searchQuery) && (
                    <span className="rounded bg-cyan-100 px-2 py-0.2 text-[11px] font-bold text-cyan-800">
                      Khớp {filteredVariants.length} / {variants.length} SKU
                    </span>
                  )}
                </div>
                {(totalActiveFilterCount > 0 || searchQuery) && (
                  <button
                    type="button"
                    onClick={handleClearAllFilters}
                    className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold underline cursor-pointer"
                  >
                    ✕ Xóa tất cả bộ lọc
                  </button>
                )}
              </div>

              {/* Attribute Group Rows */}
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {attributeGroups.map((group) => {
                  const selectedInGroup = selectedAttributes[group.code] || [];
                  const isGroupAll = selectedInGroup.length === 0;

                  return (
                    <div key={group.code} className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-semibold text-slate-600 w-24 shrink-0 text-[11px]">
                        {group.name}:
                      </span>

                      {/* 'Tất cả' chip */}
                      <button
                        type="button"
                        onClick={() => handleClearGroup(group.code)}
                        className={`rounded px-2 py-0.5 text-[11px] font-medium transition-all cursor-pointer ${
                          isGroupAll
                            ? "bg-slate-800 text-white shadow-xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                        }`}
                      >
                        Tất cả
                      </button>

                      {/* Option values */}
                      {group.values.map((val) => {
                        const isSelected = selectedInGroup.includes(val);
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleToggleAttribute(group.code, val)}
                            className={`rounded px-2 py-0.5 text-[11px] font-medium transition-all cursor-pointer border ${
                              isSelected
                                ? "bg-cyan-700 text-white border-cyan-700 font-semibold shadow-xs"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                            }`}
                          >
                            {isSelected ? `✓ ${val}` : val}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Variants Table - Full Height Expansion */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-3">
          <div className="overflow-hidden rounded-lg border border-slate-200 shadow-xs">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs font-semibold text-slate-600 uppercase sticky top-0 z-10 shadow-xs">
                <tr>
                  <th className="p-2.5 text-center w-10">
                    <input
                      type="checkbox"
                      checked={isAllVisibleChecked}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeVisibleChecked;
                      }}
                      onChange={handleToggleSelectAllVisible}
                      title="Tích chọn / Bỏ chọn tất cả các dòng đang hiển thị"
                      className="h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-600 cursor-pointer"
                    />
                  </th>
                  <th className="p-2.5">Biến thể</th>
                  <th className="p-2.5 w-44">Mã SKU</th>
                  <th className="p-2.5 w-32">Quản lý kho</th>
                  <th className="p-2.5 text-right w-28">Số lượng *</th>
                  <th className="p-2.5 text-right w-32">BH NCC (tháng)</th>
                  <th className="p-2.5 text-right w-36">Giá nhập (₫) *</th>
                  <th className="p-2.5 text-right w-36">Thành tiền (₫)</th>
                  <th className="p-2.5 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredVariants.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-10 text-center text-slate-400 text-xs">
                      Không tìm thấy biến thể nào phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  filteredVariants.map((v) => {
                    const isAlreadyInReceipt = existingVariantIds.includes(v._id);
                    const isChecked = checkedVariantIds.has(v._id);
                    const qty = quantities[v._id] || 0;
                    const cost = unitCosts[v._id] || 0;
                    const warranty = warranties[v._id] !== undefined ? warranties[v._id] : (v.supplierWarrantyMonths ?? 0);
                    const lineTotal = qty > 0 ? qty * cost : 0;
                    const isConfigured = qty > 0;

                    return (
                      <tr
                        key={v._id}
                        className={`transition-colors ${
                          isChecked
                            ? "bg-cyan-50/70 ring-1 ring-inset ring-cyan-300"
                            : isConfigured
                            ? "bg-emerald-50/25 hover:bg-emerald-50/40"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleCheck(v._id)}
                            className="h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-600 cursor-pointer"
                          />
                        </td>
                        <td className="p-2.5">
                          <div className="font-semibold text-slate-900 text-xs">
                            {v.displayName || v.sku}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {isConfigured && (
                              <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-800">
                                Đã nhập ({qty} máy)
                              </span>
                            )}
                            {isAlreadyInReceipt && (
                              <span className="inline-block rounded bg-amber-50 px-1.5 py-0.2 text-[10px] font-medium text-amber-700 border border-amber-200">
                                Đã có trong phiếu
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5 font-mono text-xs text-slate-600">
                          {v.sku}
                        </td>
                        <td className="p-2.5 text-xs text-slate-600">
                          <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
                            {trackingLabels[v.trackingMode] || v.trackingMode}
                          </span>
                        </td>
                        <td className="p-2.5 text-right">
                          <NumberInput
                            value={qty}
                            onChange={(num) => {
                              setQuantities((curr) => ({ ...curr, [v._id]: Math.max(0, num) }));
                            }}
                            placeholder="0"
                            className={`w-full rounded border px-2 py-1 text-xs text-right font-bold outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 shadow-xs ${
                              qty > 0
                                ? "border-cyan-500 bg-white text-slate-900 font-extrabold"
                                : "border-slate-300 bg-white text-slate-500"
                            }`}
                          />
                        </td>
                        <td className="p-2.5 text-right">
                          <NumberInput
                            value={warranty}
                            onChange={(num) =>
                              setWarranties((curr) => ({ ...curr, [v._id]: Math.max(0, num) }))
                            }
                            placeholder="0"
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-right font-semibold outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 shadow-xs text-slate-700"
                          />
                        </td>
                        <td className="p-2.5 text-right">
                          <NumberInput
                            value={cost}
                            onChange={(num) =>
                              setUnitCosts((curr) => ({ ...curr, [v._id]: Math.max(0, num) }))
                            }
                            placeholder="0 ₫"
                            className={`w-full rounded border px-2 py-1 text-xs text-right font-semibold outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 shadow-xs ${
                              cost > 0
                                ? "border-emerald-500 bg-white text-slate-900 font-bold"
                                : "border-slate-300 bg-white text-slate-500"
                            }`}
                          />
                        </td>
                        <td className="p-2.5 text-right font-semibold tabular-nums text-xs">
                          {lineTotal > 0 ? (
                            <span className="text-emerald-700 font-bold">{lineTotal.toLocaleString("vi-VN")} ₫</span>
                          ) : (
                            <span className="text-slate-400">0 ₫</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {qty > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setQuantities((curr) => {
                                  const next = { ...curr };
                                  delete next[v._id];
                                  return next;
                                });
                              }}
                              title="Hủy nhập SKU này (đưa số lượng về 0)"
                              className="text-slate-300 hover:text-rose-600 text-xs font-bold transition-colors cursor-pointer p-1"
                            >
                              ✕
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Summary & Actions - Compact */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3 shrink-0">
          <div className="flex items-center gap-5 text-xs">
            <div>
              <span className="text-slate-500">Đã chọn:</span>{" "}
              <strong className="font-bold text-slate-900">{selectedList.length} SKU</strong>
            </div>
            <div>
              <span className="text-slate-500">Tổng số lượng:</span>{" "}
              <strong className="font-bold text-cyan-800">{totalQuantity} máy</strong>
            </div>
            <div>
              <span className="text-slate-500">Tổng tiền dự kiến:</span>{" "}
              <strong className="font-bold text-slate-900">{totalAmount.toLocaleString("vi-VN")} ₫</strong>
            </div>
          </div>

          <div className="flex items-center gap-2.5 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={selectedList.length === 0}
              onClick={handleSubmit}
              className="rounded-md bg-cyan-700 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-cyan-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Thêm {selectedList.length} SKU vào phiếu nhập
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
