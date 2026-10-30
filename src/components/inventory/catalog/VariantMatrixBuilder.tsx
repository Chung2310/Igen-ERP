import React, { useMemo, useState, useEffect, useRef } from "react";
import { Box, Check, ChevronDown, DollarSign, Plus, Trash2, X, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "../../../pages/Toast";
import {
  type Option,
  type GeneratedVariant,
  generateMatrixFromOptions,
} from "../../../hooks/useVariantMatrix";
import { DEFAULT_PHONE_ATTRIBUTE_PRESETS, inputClassName, trackingLabels } from "./catalogConstants";
import { ImageUploadBox, NumberInput } from "./catalogUi";
import type { ProductCatalogType, ProductTrackingMode } from "../../../services/productCatalogService";
import { Dropdown, type DropdownOption } from "../../common/Dropdown";

interface VariantMatrixBuilderProps {
  options: Option[];
  setOptions: React.Dispatch<React.SetStateAction<Option[]>>;
  variantsMatrix: GeneratedVariant[];
  setVariantsMatrix: React.Dispatch<React.SetStateAction<GeneratedVariant[]>>;
  productType?: ProductCatalogType;
  trackingMode?: ProductTrackingMode;
  onTrackingModeChange?: (mode: ProductTrackingMode) => void;
  baseSku?: string;
}

export function VariantMatrixBuilder({
  options,
  setOptions,
  variantsMatrix,
  setVariantsMatrix,
  productType = "physical",
  trackingMode = "serial",
  onTrackingModeChange,
  baseSku = "",
}: VariantMatrixBuilderProps) {
  // Bulk Price & Cost Price input states (multi-select with dimension filtering)
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [selectedFilterKeys, setSelectedFilterKeys] = useState<string[]>([]);
  const [bulkPrice, setBulkPrice] = useState<number>(0);
  const [bulkCostPrice, setBulkCostPrice] = useState<number>(0);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const selectAllInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    if (isFilterDropdownOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isFilterDropdownOpen]);

  // Preset button click
  const addPresetOption = (presetKey: string) => {
    const preset = DEFAULT_PHONE_ATTRIBUTE_PRESETS[presetKey];
    if (!preset) return;
    if (options.some((o) => o.code === preset.code || o.name.toLowerCase() === preset.name.toLowerCase())) {
      toast.error(`Thuộc tính "${preset.name}" đã được thêm.`);
      return;
    }
    setOptions([...options, { code: preset.code, name: preset.name, values: [] }]);
  };

  const addCustomOption = () => {
    const idx = options.length + 1;
    setOptions([...options, { code: `OPT${idx}`, name: `Thuộc tính ${idx}`, values: [] }]);
  };

  const handleToggleOptionValue = (optIndex: number, val: string) => {
    const newOptions = [...options];
    const currentValues = newOptions[optIndex].values;
    if (currentValues.includes(val)) {
      newOptions[optIndex].values = currentValues.filter((v) => v !== val);
    } else {
      newOptions[optIndex].values = [...currentValues, val];
    }
    setOptions(newOptions);
  };

  const handleSelectAllPreset = (optIndex: number, presetOptions: string[]) => {
    const newOptions = [...options];
    newOptions[optIndex].values = [...new Set([...newOptions[optIndex].values, ...presetOptions])];
    setOptions(newOptions);
  };

  const handleClearAllPreset = (optIndex: number) => {
    const newOptions = [...options];
    newOptions[optIndex].values = [];
    setOptions(newOptions);
  };

  const handleOptionValueAdd = (index: number, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const newOptions = [...options];
    if (!newOptions[index].values.includes(trimmed)) {
      newOptions[index].values.push(trimmed);
      setOptions(newOptions);
    }
  };

  const handleOptionValueRemove = (optIndex: number, valIndex: number) => {
    const newOptions = [...options];
    newOptions[optIndex].values.splice(valIndex, 1);
    setOptions(newOptions);
  };

  const handleVariantMatrixChange = (index: number, field: keyof GeneratedVariant, value: any) => {
    const newVariants = [...variantsMatrix];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setVariantsMatrix(newVariants);
  };

  const removeMatrixRow = (index: number) => {
    setVariantsMatrix((current) => current.filter((_, i) => i !== index));
  };

  // All option keys in format: `${opt.code}:::${value}`
  const allOptionKeys = useMemo(() => {
    return options.flatMap((opt) => (opt.values || []).map((val) => `${opt.code}:::${val}`));
  }, [options]);

  // Keep indeterminate state synchronized for Select All checkbox
  useEffect(() => {
    if (selectAllInputRef.current) {
      selectAllInputRef.current.indeterminate =
        !isAllSelected && selectedFilterKeys.length > 0 && selectedFilterKeys.length < allOptionKeys.length;
    }
  }, [isAllSelected, selectedFilterKeys, allOptionKeys]);

  const handleToggleAll = () => {
    if (isAllSelected) {
      setIsAllSelected(false);
      setSelectedFilterKeys([]);
    } else {
      setIsAllSelected(true);
      setSelectedFilterKeys([...allOptionKeys]);
    }
  };

  const handleToggleFilterValue = (optCode: string, val: string) => {
    const key = `${optCode}:::${val}`;

    if (isAllSelected) {
      setIsAllSelected(false);
      setSelectedFilterKeys(allOptionKeys.filter((k) => k !== key));
      return;
    }

    let next: string[];
    if (selectedFilterKeys.includes(key)) {
      next = selectedFilterKeys.filter((k) => k !== key);
    } else {
      next = [...selectedFilterKeys, key];
      if (allOptionKeys.length > 0 && next.length === allOptionKeys.length) {
        setIsAllSelected(true);
      }
    }
    setSelectedFilterKeys(next);
  };

  const handleToggleGroup = (optCode: string) => {
    const opt = options.find((o) => o.code === optCode);
    if (!opt || !opt.values) return;
    const groupKeys = opt.values.map((v) => `${optCode}:::${v}`);
    const areAllInGroupSelected = groupKeys.every(
      (k) => isAllSelected || selectedFilterKeys.includes(k)
    );

    if (isAllSelected) {
      setIsAllSelected(false);
      setSelectedFilterKeys(allOptionKeys.filter((k) => !groupKeys.includes(k)));
    } else if (areAllInGroupSelected) {
      setSelectedFilterKeys(selectedFilterKeys.filter((k) => !groupKeys.includes(k)));
    } else {
      const next = Array.from(new Set([...selectedFilterKeys, ...groupKeys]));
      if (allOptionKeys.length > 0 && next.length === allOptionKeys.length) {
        setIsAllSelected(true);
      }
      setSelectedFilterKeys(next);
    }
  };

  const isItemChecked = (optCode: string, val: string) => {
    if (isAllSelected) return true;
    return selectedFilterKeys.includes(`${optCode}:::${val}`);
  };

  const isGroupAllSelected = (optCode: string) => {
    if (isAllSelected) return true;
    const opt = options.find((o) => o.code === optCode);
    if (!opt || !opt.values || opt.values.length === 0) return false;
    return opt.values.every((v) => selectedFilterKeys.includes(`${optCode}:::${v}`));
  };

  // Cross-dimension match logic:
  // For every option group that has AT LEAST ONE selected value, the variant must match one of those selected values.
  // Option groups with zero selected values do not restrict the variant (match all in that group).
  const doesVariantMatch = (v: GeneratedVariant): boolean => {
    if (isAllSelected) return true;
    if (selectedFilterKeys.length === 0) return false;

    for (const opt of options) {
      if (!opt.values || opt.values.length === 0) continue;

      const selectedInThisOpt = opt.values.filter((val) =>
        selectedFilterKeys.includes(`${opt.code}:::${val}`)
      );

      if (selectedInThisOpt.length > 0) {
        const vVal = v.optionValues?.find((ov) => ov.code === opt.code)?.value;
        if (!vVal || !selectedInThisOpt.includes(vVal)) {
          return false;
        }
      }
    }

    return true;
  };

  const matchedVariantsCount = useMemo(() => {
    if (variantsMatrix.length === 0) return 0;
    if (isAllSelected) return variantsMatrix.length;
    if (selectedFilterKeys.length === 0) return 0;
    return variantsMatrix.filter(doesVariantMatch).length;
  }, [variantsMatrix, isAllSelected, selectedFilterKeys, options]);

  const filterLabel = useMemo(() => {
    if (isAllSelected) {
      return `Tất cả (${variantsMatrix.length} SKU)`;
    }
    if (selectedFilterKeys.length === 0) {
      return "-- Chọn bản --";
    }
    return `Khớp ${matchedVariantsCount} SKU`;
  }, [isAllSelected, selectedFilterKeys.length, matchedVariantsCount, variantsMatrix.length]);

  // Bulk Apply Price & Cost Price
  const applyBulkPrice = () => {
    if (!isAllSelected && selectedFilterKeys.length === 0) {
      toast.error("Vui lòng chọn ít nhất một bản hoặc chọn 'Chọn tất cả'.");
      return;
    }
    if (bulkPrice <= 0 && bulkCostPrice <= 0) {
      toast.error("Vui lòng nhập giá bán hoặc giá vốn hợp lệ.");
      return;
    }
    if (matchedVariantsCount === 0) {
      toast.error("Không có SKU nào phù hợp với bộ lọc đã chọn.");
      return;
    }

    setVariantsMatrix((current) =>
      current.map((v) => {
        if (doesVariantMatch(v)) {
          const updated = { ...v };
          if (bulkPrice > 0) updated.price = bulkPrice;
          if (bulkCostPrice > 0) updated.costPrice = bulkCostPrice;
          return updated;
        }
        return v;
      })
    );

    const parts: string[] = [];
    if (bulkPrice > 0) parts.push(`giá bán ${bulkPrice.toLocaleString("vi-VN")} ₫`);
    if (bulkCostPrice > 0) parts.push(`giá vốn ${bulkCostPrice.toLocaleString("vi-VN")} ₫`);

    if (isAllSelected) {
      toast.success(`Đã áp dụng ${parts.join(" & ")} cho tất cả ${variantsMatrix.length} SKU.`);
    } else {
      toast.success(`Đã áp dụng ${parts.join(" & ")} cho ${matchedVariantsCount} SKU phù hợp.`);
    }
  };

  // Filter active options with values
  const validOptions = useMemo(() => options.filter((o) => o.values && o.values.length > 0), [options]);
  const expectedCombinationsCount = useMemo(() => {
    if (validOptions.length === 0) return 0;
    return validOptions.reduce((acc, curr) => acc * curr.values.length, 1);
  }, [validOptions]);

  // Serialized options to detect real value changes
  const optionsSignature = useMemo(() => {
    return options.map((o) => `${o.code}:${[...o.values].sort().join(",")}`).join(";");
  }, [options]);

  // Automatically generate / synchronize variantsMatrix when options change
  useEffect(() => {
    if (validOptions.length === 0) {
      return;
    }

    const newMatrix = generateMatrixFromOptions(options, baseSku, variantsMatrix);
    const currentKeys = variantsMatrix
      .map((v) => (v.optionValues || []).map((ov) => `${ov.code}:${ov.value}`).sort().join("|"))
      .join(";");
    const newKeys = newMatrix
      .map((v) => (v.optionValues || []).map((ov) => `${ov.code}:${ov.value}`).sort().join("|"))
      .join(";");

    if (currentKeys !== newKeys) {
      setVariantsMatrix(newMatrix);
    }
  }, [optionsSignature, baseSku]);

  // Explicit confirmation button action
  const handleConfirmGenerate = () => {
    const matrix = generateMatrixFromOptions(options, baseSku, variantsMatrix);
    setVariantsMatrix(matrix);
    toast.success(`Đã tạo thành công ma trận ${matrix.length} biến thể SKU!`);
  };

  const handleClearMatrix = () => {
    setVariantsMatrix([]);
    toast.info("Đã xóa toàn bộ ma trận biến thể.");
  };

  return (
    <div className="space-y-4">
      {/* Preset quick-add buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            Thuộc tính (Màu sắc × Dung lượng × Tình trạng)
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">Chọn nhanh hoặc thêm thuộc tính để hệ thống tự động tạo các phiên bản sản phẩm.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => addPresetOption("COLOR")}
            className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 transition-colors"
          >
            + Màu sắc
          </button>
          <button
            type="button"
            onClick={() => addPresetOption("STORAGE")}
            className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 transition-colors"
          >
            + Dung lượng
          </button>
          <button
            type="button"
            onClick={() => addPresetOption("CONDITION")}
            className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 transition-colors"
          >
            + Tình trạng
          </button>
          <button
            type="button"
            onClick={() => addPresetOption("ORIGIN")}
            className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 transition-colors"
          >
            + Xuất xứ
          </button>
          <button
            type="button"
            onClick={addCustomOption}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Thuộc tính khác
          </button>
        </div>
      </div>

      {/* Option cards */}
      {options.length > 0 && (
        <div className="space-y-4 pt-1">
          {options.map((opt, optIndex) => {
            const preset = DEFAULT_PHONE_ATTRIBUTE_PRESETS[opt.code];
            const suggestedOptions = preset?.options || [];

            return (
              <div key={opt.code + optIndex} className="relative rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-300">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-cyan-700 text-[11px] font-bold text-white">
                      {optIndex + 1}
                    </span>
                    <input
                      className="bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-b focus:border-cyan-500 pb-0.5"
                      value={opt.name}
                      onChange={(e) => {
                        const newOpts = [...options];
                        newOpts[optIndex].name = e.target.value;
                        setOptions(newOpts);
                      }}
                      placeholder="Tên thuộc tính (VD: Màu sắc)"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {suggestedOptions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleSelectAllPreset(optIndex, suggestedOptions)}
                        className="text-[11px] text-cyan-700 hover:underline font-medium"
                      >
                        Chọn tất cả
                      </button>
                    )}
                    {opt.values.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleClearAllPreset(optIndex)}
                        className="text-[11px] text-slate-400 hover:text-rose-600 font-medium ml-1"
                      >
                        Xóa chọn
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setOptions(options.filter((_, i) => i !== optIndex))}
                      className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-rose-600 transition-colors"
                      title="Xóa thuộc tính này"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Preset quick-toggle chips */}
                {suggestedOptions.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[11px] font-medium text-slate-500 mb-1.5">Gợi ý chọn nhanh:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedOptions.map((suggestedVal) => {
                        const isSelected = opt.values.includes(suggestedVal);
                        return (
                          <button
                            key={suggestedVal}
                            type="button"
                            onClick={() => handleToggleOptionValue(optIndex, suggestedVal)}
                            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                              isSelected
                                ? "bg-cyan-700 text-white shadow-sm ring-1 ring-cyan-700"
                                : "bg-white text-slate-700 border border-slate-200 hover:border-cyan-400 hover:bg-cyan-50/50"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3 text-white" />}
                            {suggestedVal}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Selected values tags */}
                {opt.values.length > 0 && (
                  <div className="mb-3 flex flex-wrap items-center gap-1.5 bg-white p-2 rounded border border-slate-200/80">
                    <span className="text-[11px] font-medium text-slate-400 mr-1">Đã chọn ({opt.values.length}):</span>
                    {opt.values.map((val, valIndex) => (
                      <span key={valIndex} className="flex items-center gap-1 rounded bg-cyan-100 pl-2 pr-1 py-0.5 text-xs font-medium text-cyan-800">
                        {val}
                        <button
                          type="button"
                          onClick={() => handleOptionValueRemove(optIndex, valIndex)}
                          className="rounded-sm p-0.5 text-cyan-600 hover:bg-cyan-200 hover:text-cyan-900"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Input custom value */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder={`Gõ thêm giá trị ${opt.name} khác và nhấn Enter...`}
                    className={inputClassName("text-xs shadow-sm bg-white")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleOptionValueAdd(optIndex, e.currentTarget.value);
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                  <span className="absolute right-3 top-2 text-[11px] text-slate-400 font-mono">↵ Enter</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Matrix Table */}
      {options.length > 0 && (
        <div className="pt-4 mt-4 border-t border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <span>Danh sách phiên bản ({variantsMatrix.length} SKU)</span>
                {validOptions.length > 0 && (
                  <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-bold text-cyan-800">
                    {validOptions.map((o) => `${o.values.length} ${o.name}`).join(" × ")}
                  </span>
                )}
                {expectedCombinationsCount > 0 && variantsMatrix.length !== expectedCombinationsCount && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 animate-pulse">
                    {expectedCombinationsCount} tổ hợp chờ tạo
                  </span>
                )}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">Danh sách tự động cập nhật khi bạn chọn đặc tính. Nhập giá bán cho từng dòng.</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              {onTrackingModeChange && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-medium">Quản lý kho:</span>
                  <Dropdown<ProductTrackingMode>
                    disabled={productType === "service"}
                    value={productType === "service" ? "none" : trackingMode}
                    onChange={onTrackingModeChange}
                    options={[
                      { value: "serial", label: "Theo số sê-ri / IMEI" },
                      { value: "quantity", label: "Theo số lượng" },
                      { value: "unit_barcode", label: "Theo mã vạch đơn vị" },
                      { value: "none", label: "Không theo dõi" },
                    ]}
                    variant="default"
                    size="xs"
                    triggerClassName="font-medium text-xs"
                  />
                </div>
              )}
              {validOptions.length > 0 && (
                <button
                  type="button"
                  onClick={handleConfirmGenerate}
                  title="Tạo lại danh sách phiên bản từ các thuộc tính đã chọn"
                  className="inline-flex items-center gap-1.5 rounded-md bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-cyan-800 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {variantsMatrix.length === 0 ? "Tạo danh sách" : "Làm mới"}
                </button>
              )}
              {variantsMatrix.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearMatrix}
                  title="Xóa toàn bộ danh sách phiên bản"
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Xóa
                </button>
              )}
            </div>
          </div>

          {/* Bulk Price & Cost Price Action Toolbar */}
          {variantsMatrix.length > 0 && (
            <div className="rounded-lg border border-cyan-200 bg-cyan-50/60 p-3 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-900">
                  <DollarSign className="h-4 w-4 text-cyan-700" />
                  Áp giá bán &amp; giá vốn hàng loạt cho các phiên bản:
                </div>
                <span className="text-[11px] text-cyan-700">Chọn phiên bản áp dụng, nhập giá bán / giá vốn rồi bấm Áp dụng</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-md border border-cyan-100 shadow-sm">
                {/* Dropdown Multi-select */}
                <div className="relative" ref={filterDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsFilterDropdownOpen((prev) => !prev)}
                    className="inline-flex items-center justify-between gap-2 h-9 min-w-[160px] max-w-[240px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:border-cyan-500 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <span className="truncate">{filterLabel}</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isFilterDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isFilterDropdownOpen && (
                    <div className="absolute left-0 top-full mt-1 w-72 rounded-lg border border-slate-200 bg-white shadow-xl z-30 p-2 animate-in fade-in zoom-in-95 duration-100">
                      {/* Chọn tất cả */}
                      <label className="flex items-center gap-2.5 px-2 py-1.5 text-xs font-semibold text-slate-800 hover:bg-cyan-50/70 rounded-md cursor-pointer select-none transition-colors">
                        <input
                          type="checkbox"
                          ref={selectAllInputRef}
                          checked={isAllSelected}
                          onChange={handleToggleAll}
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 accent-cyan-700 cursor-pointer"
                        />
                        <span>Chọn tất cả ({variantsMatrix.length} SKU)</span>
                      </label>

                      <div className="my-1.5 border-t border-slate-100" />

                      {/* Danh sách bản theo từng nhóm thuộc tính */}
                      <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                        {options
                          .filter((opt) => opt.values && opt.values.length > 0)
                          .map((opt) => {
                            const groupAll = isGroupAllSelected(opt.code);
                            return (
                              <div
                                key={opt.code}
                                className="space-y-0.5 rounded-md bg-slate-50/60 p-1.5 border border-slate-100"
                              >
                                <div className="flex items-center justify-between px-1.5 py-0.5">
                                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                    {opt.name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleGroup(opt.code)}
                                    className="text-[10px] font-semibold text-cyan-700 hover:text-cyan-800 hover:underline cursor-pointer"
                                  >
                                    {groupAll ? "Bỏ nhóm" : "Chọn nhóm"}
                                  </button>
                                </div>
                                <div className="grid grid-cols-1 gap-0.5">
                                  {opt.values.map((val) => {
                                    const checked = isItemChecked(opt.code, val);
                                    return (
                                      <label
                                        key={val}
                                        className={`flex items-center gap-2 px-2 py-1 text-xs rounded cursor-pointer select-none transition-colors ${
                                          checked
                                            ? "bg-cyan-50/80 text-cyan-900 font-medium"
                                            : "text-slate-700 hover:bg-slate-100/70"
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => handleToggleFilterValue(opt.code, val)}
                                          className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 accent-cyan-700 cursor-pointer"
                                        />
                                        <span className="truncate">{val}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        {allOptionKeys.length === 0 && (
                          <div className="px-2.5 py-3 text-xs text-slate-400 text-center">Chưa có thuộc tính nào</div>
                        )}
                      </div>

                      {/* Footer tóm tắt & bỏ chọn */}
                      <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between px-2 text-[11px]">
                        <span className="text-slate-600 font-medium">
                          {isAllSelected
                            ? `Tất cả (${variantsMatrix.length} SKU)`
                            : selectedFilterKeys.length === 0
                            ? "Chưa chọn bản nào"
                            : `Khớp ${matchedVariantsCount} / ${variantsMatrix.length} SKU`}
                        </span>
                        {(isAllSelected || selectedFilterKeys.length > 0) && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsAllSelected(false);
                              setSelectedFilterKeys([]);
                            }}
                            className="text-cyan-700 hover:text-cyan-800 font-semibold hover:underline cursor-pointer"
                          >
                            Bỏ chọn
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Giá bán & Giá vốn */}
                <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                  <div className="relative flex-1">
                    <NumberInput
                      value={bulkPrice}
                      onChange={(val) => setBulkPrice(val)}
                      className={inputClassName("py-1.5 text-xs text-right font-bold text-cyan-800 bg-cyan-50/20")}
                      placeholder="Giá bán..."
                    />
                  </div>
                  <div className="relative flex-1">
                    <NumberInput
                      value={bulkCostPrice}
                      onChange={(val) => setBulkCostPrice(val)}
                      className={inputClassName("py-1.5 text-xs text-right font-semibold text-slate-600 bg-slate-50/40")}
                      placeholder="Giá vốn..."
                    />
                  </div>
                </div>

                {/* Nút Áp dụng */}
                <button
                  type="button"
                  onClick={applyBulkPrice}
                  className="shrink-0 rounded bg-cyan-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-cyan-800 transition-colors shadow-sm"
                >
                  Áp dụng
                </button>
              </div>
            </div>
          )}

          {/* Matrix table */}
          <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm">
            <div className="overflow-x-auto max-h-[450px]">
              <table className="w-full text-left text-sm relative">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-2.5 font-semibold w-[50px] text-center">Ảnh</th>
                    <th className="p-2.5 font-semibold w-[20%]">Phiên bản</th>
                    <th className="p-2.5 font-semibold w-[18%]">Mã SKU</th>
                    <th className="p-2.5 font-semibold w-[16%]">Mã vạch</th>
                    <th className="p-2.5 font-semibold w-[16%] text-right text-cyan-800">Giá bán (₫) *</th>
                    <th className="p-2.5 font-semibold w-[14%] text-right text-slate-600">Giá vốn (₫)</th>
                    <th className="p-2.5 font-semibold text-center w-[40px]">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {variantsMatrix.length > 0 ? (
                    variantsMatrix.map((variantItem, index) => (
                      <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2 text-center">
                          <ImageUploadBox
                            value={variantItem.mediaIds?.[0]}
                            onChange={(url) => handleVariantMatrixChange(index, "mediaIds", [url])}
                            className="h-10 w-10 !rounded-md mx-auto"
                          />
                        </td>
                        <td className="p-2.5">
                          <div className="flex flex-wrap gap-1">
                            {variantItem.optionValues.map((v, i) => (
                              <span key={i} className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                                {v.value}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-2.5">
                          <input
                            className={inputClassName("py-1.5 text-xs font-mono font-medium")}
                            placeholder="Mã SKU"
                            value={variantItem.sku}
                            onChange={(e) => handleVariantMatrixChange(index, "sku", e.target.value)}
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            className={inputClassName("py-1.5 text-xs font-mono text-slate-600")}
                            placeholder="Mã vạch..."
                            value={variantItem.barcode || ""}
                            onChange={(e) => handleVariantMatrixChange(index, "barcode", e.target.value)}
                          />
                        </td>
                        <td className="p-2.5 text-right">
                          <NumberInput
                            className={inputClassName("py-1.5 text-xs text-right font-bold text-cyan-700 bg-cyan-50/30 focus:bg-white")}
                            placeholder="0 ₫"
                            value={variantItem.price || ""}
                            onChange={(num) => handleVariantMatrixChange(index, "price", num)}
                          />
                        </td>
                        <td className="p-2.5 text-right">
                          <NumberInput
                            className={inputClassName("py-1.5 text-xs text-right text-slate-600")}
                            placeholder="0 ₫"
                            value={variantItem.costPrice || ""}
                            onChange={(num) => handleVariantMatrixChange(index, "costPrice", num)}
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeMatrixRow(index)}
                            className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                            title="Loại bỏ SKU này"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-10 text-center">
                        {validOptions.length === 0 ? (
                          <>
                            <Box className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                            <h4 className="text-sm font-semibold text-slate-700">Chưa chọn phân loại sản phẩm</h4>
                            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                              Hãy chọn hoặc nhập ít nhất một đặc tính ở trên (Màu sắc, Dung lượng...) — danh sách sản phẩm sẽ tự động hiển thị.
                            </p>
                          </>
                        ) : (
                          <>
                            <Sparkles className="mx-auto h-8 w-8 text-cyan-300 mb-2" />
                            <h4 className="text-sm font-semibold text-slate-700">
                              Sẵn sàng tạo {expectedCombinationsCount} phiên bản sản phẩm
                            </h4>
                            <p className="text-xs text-slate-500 mt-1 mb-3 max-w-sm mx-auto">
                              {validOptions.map((o) => `${o.values.length} ${o.name}`).join(" × ")} tổ hợp được tìm thấy.
                              Danh sách sẽ tự động cập nhật.
                            </p>
                            <button
                              type="button"
                              onClick={handleConfirmGenerate}
                              className="inline-flex items-center gap-1.5 rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-800 transition-colors"
                            >
                              <Sparkles className="h-4 w-4" />
                              Tạo danh sách ngay
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
