import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, ChevronDown, Check, Plus, Tag, X, Loader2 } from "lucide-react";
import { categoryService } from "../../services/categoryService";
import type { CategoryRecord, CategoryInput } from "../../types/category";
import { toast } from "../../pages/Toast";

interface CategorySelectProps {
  value: string;
  onChange: (categoryName: string, categoryId?: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  blue: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  rose: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  purple: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
};

export const CategorySelect: React.FC<CategorySelectProps> = ({
  value,
  onChange,
  placeholder = "Chọn hoặc thêm phân loại sản phẩm...",
  required = false,
  className = "",
  disabled = false,
}) => {
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Quick add modal
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickForm, setQuickForm] = useState<CategoryInput>({
    code: "",
    name: "",
    description: "",
    color: "emerald",
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const list = await categoryService.list({ activeOnly: true });
      setCategories(list);
    } catch (err) {
      console.error("Error loading categories:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filtered = categories.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q))
    );
  });

  const selectedCat = categories.find((c) => c.name === value) || null;

  const handleSelect = (cat: CategoryRecord) => {
    onChange(cat.name, cat._id);
    setIsOpen(false);
    setSearch("");
  };

  const handleOpenQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    const suggestedCode = `DM-${Date.now().toString().slice(-4)}`;
    setQuickForm({
      code: suggestedCode,
      name: search.trim() || "",
      description: "",
      color: "emerald",
    });
    setShowQuickAdd(true);
    setIsOpen(false);
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // CategorySelect is rendered inside the supply form. Keep this nested
    // quick-add submit from also submitting (and closing) the parent form.
    e.stopPropagation();
    if (!quickForm.name.trim()) {
      toast.error("Vui lòng nhập tên phân loại.");
      return;
    }
    if (!quickForm.code.trim()) {
      toast.error("Vui lòng nhập mã phân loại.");
      return;
    }

    setQuickAddLoading(true);
    try {
      const created = await categoryService.create(quickForm);
      setCategories((current) =>
        [...current.filter((category) => category._id !== created._id), created]
          .sort((a, b) => a.name.localeCompare(b.name, "vi")),
      );
      onChange(created.name, created._id);
      setShowQuickAdd(false);
      toast.success(`Đã thêm phân loại '${created.name}'!`);
    } catch (err: any) {
      toast.error(err.message || "Không thể tạo phân loại.");
    } finally {
      setQuickAddLoading(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Input box */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2 bg-white border rounded-xl text-sm transition cursor-pointer ${
          disabled ? "opacity-60 cursor-not-allowed bg-slate-100 border-slate-200" : "border-slate-200 hover:border-slate-300 shadow-2xs"
        } ${isOpen ? "ring-2 ring-emerald-500/20 border-emerald-500" : ""}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Tag className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className={`truncate text-sm ${value ? "text-slate-800 font-medium" : "text-slate-400"}`}>
            {value || placeholder}
          </span>
          {selectedCat?.code && (
            <span className="hidden sm:inline text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
              {selectedCat.code}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          {value && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("", undefined);
              }}
              className="p-1 hover:bg-slate-200/60 rounded-md text-slate-400 hover:text-slate-600 transition"
              title="Xóa lựa chọn"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-2 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm tên phân loại, mã..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <button
              type="button"
              onClick={handleOpenQuickAdd}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition shrink-0"
              title="Thêm phân loại mới"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm mới</span>
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-left">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-slate-400 gap-2 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Đang tải danh mục phân loại...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs text-slate-500">Không tìm thấy phân loại nào khớp với &quot;{search}&quot;</p>
                <button
                  type="button"
                  onClick={handleOpenQuickAdd}
                  className="mt-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tạo nhanh phân loại &quot;{search || "mới"}&quot;
                </button>
              </div>
            ) : (
              filtered.map((cat) => {
                const isSelected = cat.name === value;
                const colorStyle = COLOR_MAP[cat.color || "emerald"] || COLOR_MAP.emerald;
                return (
                  <div
                    key={cat._id}
                    onClick={() => handleSelect(cat)}
                    className={`p-2.5 flex items-center justify-between gap-2 cursor-pointer transition ${
                      isSelected ? "bg-emerald-50/70" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-sm font-semibold truncate ${isSelected ? "text-emerald-900" : "text-slate-800"}`}>
                          {cat.name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {cat.code}
                        </span>
                        {cat.color && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full border ${colorStyle.bg} ${colorStyle.text} ${colorStyle.border}`}>
                            {cat.name}
                          </span>
                        )}
                      </div>

                      {cat.description && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{cat.description}</p>
                      )}
                    </div>

                    {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Modal Thêm Nhanh Phân Loại */}
      {showQuickAdd && createPortal((
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150 text-left">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">Thêm nhanh Phân loại sản phẩm</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAdd(false)}
                className="p-1 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAddSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Mã phân loại <span className="text-rose-500 font-bold ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={quickForm.code}
                  onChange={(e) => setQuickForm({ ...quickForm, code: e.target.value.toUpperCase() })}
                  placeholder="vd: DM-GANG-TAY"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Tên phân loại sản phẩm <span className="text-rose-500 font-bold ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={quickForm.name}
                  onChange={(e) => setQuickForm({ ...quickForm, name: e.target.value })}
                  placeholder="vd: Găng tay & Bảo hộ y tế"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Màu nhãn phân loại
                </label>
                <div className="flex items-center gap-2">
                  {[
                    { id: "emerald", label: "Xanh lá", bg: "bg-emerald-500" },
                    { id: "blue", label: "Xanh dương", bg: "bg-blue-500" },
                    { id: "amber", label: "Vàng cam", bg: "bg-amber-500" },
                    { id: "rose", label: "Hồng đỏ", bg: "bg-rose-500" },
                    { id: "purple", label: "Tím", bg: "bg-purple-500" },
                    { id: "indigo", label: "Chàm", bg: "bg-indigo-500" },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setQuickForm({ ...quickForm, color: c.id })}
                      className={`w-6 h-6 rounded-full ${c.bg} transition-all cursor-pointer ${
                        quickForm.color === c.id ? "ring-2 ring-offset-2 ring-slate-800 scale-110" : "opacity-70 hover:opacity-100"
                      }`}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Mô tả / Ghi chú
                </label>
                <textarea
                  rows={2}
                  value={quickForm.description}
                  onChange={(e) => setQuickForm({ ...quickForm, description: e.target.value })}
                  placeholder="Mô tả nhóm vật tư thuộc phân loại này..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={quickAddLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-600/10 transition disabled:opacity-60 cursor-pointer"
                >
                  {quickAddLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Lưu & Chọn ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      ), document.body)}
    </div>
  );
};
