import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Filter,
  Calendar,
  Building2,
  Warehouse as WarehouseIcon,
  Tag,
  ChevronDown,
  RotateCcw,
  X,
  Check,
} from "lucide-react";
import type { SupplierRecord } from "../../types/supplier";
import type { WarehouseRecord } from "../../types/warehouse";
import type { CategoryRecord } from "../../types/category";

interface Props {
  search: string;
  setSearch: (val: string) => void;
  status: string;
  setStatus: (val: string) => void;
  expiryStatus: string;
  setExpiryStatus: (val: string) => void;
  category: string;
  setCategory: (val: string) => void;
  supplier: string;
  setSupplier: (val: string) => void;
  warehouse: string;
  setWarehouse: (val: string) => void;
  suppliers?: SupplierRecord[];
  warehouses?: WarehouseRecord[];
  categories?: CategoryRecord[];
  onSubmit: (e: React.FormEvent) => void;
  onFilterChange: () => void;
}

interface DropdownOption {
  value: string;
  label: string;
  sublabel?: string;
  colorBadge?: string;
}

interface CustomFilterDropdownProps {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  placeholder: string;
  options: DropdownOption[];
  isOpen: boolean;
  alignRight?: boolean;
  onToggle: () => void;
  onSelect: (val: string) => void;
  onClear: () => void;
  enableSearch?: boolean;
}

const CustomFilterDropdown: React.FC<CustomFilterDropdownProps> = ({
  icon: Icon,
  label,
  value,
  placeholder,
  options,
  isOpen,
  alignRight = false,
  onToggle,
  onSelect,
  onClear,
  enableSearch = false,
}) => {
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
    } else if (enableSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, enableSearch]);

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;
  const isSelected = Boolean(value);

  const filteredOptions = query
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          (o.sublabel && o.sublabel.toLowerCase().includes(query.toLowerCase())),
      )
    : options;

  return (
    <div className="relative">
      {/* Nút bấm mở dropdown (Không dùng thẻ select gốc để tránh trùng icon và giao diện xấu) */}
      <div
        onClick={onToggle}
        className={`w-full text-left flex items-center gap-2 px-3 py-2 bg-white border rounded-xl transition-all shadow-2xs cursor-pointer group select-none ${
          isSelected
            ? "border-emerald-400 bg-emerald-50/25 text-emerald-950 ring-1 ring-emerald-500/10"
            : "border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50/50"
        } ${isOpen ? "ring-2 ring-emerald-500/20 border-emerald-500 bg-white" : ""}`}
      >
        <Icon
          className={`w-4 h-4 shrink-0 transition ${
            isSelected ? "text-emerald-600" : "text-slate-400 group-hover:text-emerald-600"
          }`}
        />
        <div className="flex-1 min-w-0 pr-1">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none mb-1">
            {label}
          </span>
          <span
            className={`block text-xs font-semibold truncate ${
              isSelected ? "text-emerald-900 font-bold" : "text-slate-800"
            }`}
          >
            {displayLabel}
          </span>
        </div>

        {/* Nút xóa nhanh giá trị đã chọn hoặc 1 mũi tên chevron duy nhất */}
        <div className="flex items-center gap-1 shrink-0">
          {isSelected && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="p-1 hover:bg-emerald-100/70 text-slate-400 hover:text-emerald-700 rounded-md transition cursor-pointer"
              title="Xóa lựa chọn này"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isOpen
                ? "rotate-180 text-emerald-600"
                : isSelected
                  ? "text-emerald-600"
                  : "text-slate-400 group-hover:text-slate-600"
            }`}
          />
        </div>
      </div>

      {/* Menu tùy chỉnh hiện đại với hiệu ứng mượt mà */}
      {isOpen && (
        <div
          className={`absolute top-full mt-1.5 w-full min-w-[230px] max-w-[320px] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
            alignRight ? "right-0" : "left-0"
          }`}
        >
          {enableSearch && options.length > 5 && (
            <div className="p-2 border-b border-slate-100 bg-slate-50/70">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={`Tìm ${label.toLowerCase()}...`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5 text-left">
            {filteredOptions.length === 0 ? (
              <div className="py-4 px-2 text-center text-xs text-slate-400">
                Không tìm thấy {label.toLowerCase()} phù hợp
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isItemActive = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onSelect(opt.value)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition cursor-pointer text-left ${
                      isItemActive
                        ? "bg-emerald-50/90 text-emerald-900 font-bold"
                        : "text-slate-700 hover:bg-slate-50 font-medium"
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="truncate">{opt.label}</span>
                        {opt.colorBadge && (
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold border ${opt.colorBadge}`}
                          >
                            {opt.label}
                          </span>
                        )}
                      </div>
                      {opt.sublabel && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5 font-normal">{opt.sublabel}</p>
                      )}
                    </div>
                    {isItemActive && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const SupplyFiltersBar: React.FC<Props> = ({
  search,
  setSearch,
  status,
  setStatus,
  expiryStatus,
  setExpiryStatus,
  category,
  setCategory,
  supplier,
  setSupplier,
  warehouse,
  setWarehouse,
  suppliers = [],
  warehouses = [],
  categories = [],
  onSubmit,
  onFilterChange,
}) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const filterContainerRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click bên ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterContainerRef.current && !filterContainerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeFiltersCount = [status, expiryStatus, category, supplier, warehouse].filter(Boolean).length;

  const hasAnyFilter = Boolean(search || activeFiltersCount > 0);

  const handleClearAll = () => {
    setSearch("");
    setStatus("");
    setExpiryStatus("");
    setCategory("");
    setSupplier("");
    setWarehouse("");
    setOpenDropdown(null);
    onFilterChange();
  };

  const handleSelectFilter = (setter: (val: string) => void, val: string) => {
    setter(val);
    setOpenDropdown(null);
    onFilterChange();
  };

  // Dữ liệu options cho 5 bộ lọc
  const categoryOptions: DropdownOption[] = [
    { value: "", label: "Tất cả phân loại" },
    ...categories.map((c) => ({
      value: c.name,
      label: c.name,
      sublabel: c.code ? `Mã: ${c.code}` : undefined,
    })),
  ];

  const supplierOptions: DropdownOption[] = [
    { value: "", label: "Tất cả nhà cung cấp" },
    ...suppliers.map((s) => ({
      value: s.name,
      label: s.shortName || s.name,
      sublabel: s.shortName && s.name !== s.shortName ? s.name : undefined,
    })),
  ];

  const warehouseOptions: DropdownOption[] = [
    { value: "", label: "Tất cả kho lưu trữ" },
    ...warehouses.map((w) => ({
      value: w.name,
      label: w.name,
      sublabel: w.location ? `Vị trí: ${w.location}` : undefined,
    })),
  ];

  const expiryOptions: DropdownOption[] = [
    { value: "", label: "Tất cả hạn dùng" },
    {
      value: "expiring_soon_30",
      label: "Sắp hết hạn (< 30 ngày)",
      colorBadge: "text-amber-700 bg-amber-50 border-amber-200",
    },
    {
      value: "expiring_soon_60",
      label: "Sắp hết hạn (< 60 ngày)",
      colorBadge: "text-amber-600 bg-amber-50 border-amber-200",
    },
    {
      value: "expired",
      label: "Đã hết hạn",
      colorBadge: "text-rose-700 bg-rose-50 border-rose-200",
    },
    {
      value: "valid",
      label: "Còn hạn tốt",
      colorBadge: "text-emerald-700 bg-emerald-50 border-emerald-200",
    },
  ];

  const statusOptions: DropdownOption[] = [
    { value: "quarantined", label: "Chưa xác minh hạn dùng" },
    { value: "", label: "Tất cả mức tồn" },
    {
      value: "in-stock",
      label: "Còn hàng",
      colorBadge: "text-emerald-700 bg-emerald-50 border-emerald-200",
    },
    {
      value: "low-stock",
      label: "Sắp hết hàng",
      colorBadge: "text-amber-700 bg-amber-50 border-amber-200",
    },
    {
      value: "out-of-stock",
      label: "Hết hàng",
      colorBadge: "text-rose-700 bg-rose-50 border-rose-200",
    },
  ];

  return (
    <div
      ref={filterContainerRef}
      className="p-4 border-b border-slate-100 bg-slate-50/40 space-y-3 text-left rounded-t-2xl"
    >
      {/* Tầng 1: Tìm kiếm chính & Nút hành động */}
      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="h-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Tìm tên vật tư, mã VT, số lô, nhà cung cấp, vị trí kho..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder-slate-400 text-slate-800 shadow-2xs transition"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                onFilterChange();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md transition cursor-pointer"
              title="Xóa tìm kiếm"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition shadow-md shadow-emerald-600/10 active:scale-95 cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>Lọc dữ liệu</span>
          </button>

          {hasAnyFilter && (
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 border border-dashed border-rose-200 hover:border-rose-300 bg-rose-50/50 hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-semibold transition cursor-pointer active:scale-95"
              title="Đặt lại toàn bộ bộ lọc"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Đặt lại</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-rose-200 text-rose-700 text-[10px] flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          )}
        </div>
      </form>

      {/* Tầng 2: 5 Ô bộ lọc tùy chỉnh đẹp mắt, không dùng thẻ select gốc, duy nhất 1 icon mũi tên */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {/* 1. Lọc Phân loại */}
        <CustomFilterDropdown
          id="category"
          icon={Tag}
          label="Phân loại"
          value={category}
          placeholder="Tất cả phân loại"
          options={categoryOptions}
          isOpen={openDropdown === "category"}
          alignRight={false}
          onToggle={() => setOpenDropdown(openDropdown === "category" ? null : "category")}
          onSelect={(val) => handleSelectFilter(setCategory, val)}
          onClear={() => handleSelectFilter(setCategory, "")}
          enableSearch={categories.length > 5}
        />

        {/* 2. Lọc Nhà cung cấp */}
        <CustomFilterDropdown
          id="supplier"
          icon={Building2}
          label="Nhà cung cấp"
          value={supplier}
          placeholder="Tất cả NCC"
          options={supplierOptions}
          isOpen={openDropdown === "supplier"}
          alignRight={false}
          onToggle={() => setOpenDropdown(openDropdown === "supplier" ? null : "supplier")}
          onSelect={(val) => handleSelectFilter(setSupplier, val)}
          onClear={() => handleSelectFilter(setSupplier, "")}
          enableSearch={suppliers.length > 5}
        />

        {/* 3. Lọc Kho lưu trữ */}
        <CustomFilterDropdown
          id="warehouse"
          icon={WarehouseIcon}
          label="Kho lưu trữ"
          value={warehouse}
          placeholder="Tất cả kho"
          options={warehouseOptions}
          isOpen={openDropdown === "warehouse"}
          alignRight={false}
          onToggle={() => setOpenDropdown(openDropdown === "warehouse" ? null : "warehouse")}
          onSelect={(val) => handleSelectFilter(setWarehouse, val)}
          onClear={() => handleSelectFilter(setWarehouse, "")}
          enableSearch={warehouses.length > 5}
        />

        {/* 4. Lọc Hạn sử dụng */}
        <CustomFilterDropdown
          id="expiry"
          icon={Calendar}
          label="Hạn sử dụng"
          value={expiryStatus}
          placeholder="Tất cả hạn dùng"
          options={expiryOptions}
          isOpen={openDropdown === "expiry"}
          alignRight={true}
          onToggle={() => setOpenDropdown(openDropdown === "expiry" ? null : "expiry")}
          onSelect={(val) => handleSelectFilter(setExpiryStatus, val)}
          onClear={() => handleSelectFilter(setExpiryStatus, "")}
        />

        {/* 5. Lọc Tồn kho */}
        <CustomFilterDropdown
          id="status"
          icon={Filter}
          label="Tồn kho"
          value={status}
          placeholder="Tất cả mức tồn"
          options={statusOptions}
          isOpen={openDropdown === "status"}
          alignRight={true}
          onToggle={() => setOpenDropdown(openDropdown === "status" ? null : "status")}
          onSelect={(val) => handleSelectFilter(setStatus, val)}
          onClear={() => handleSelectFilter(setStatus, "")}
        />
      </div>
    </div>
  );
};
