import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, ChevronDown, Check, Plus, Building2, Phone, Mail, X, Loader2 } from "lucide-react";
import { supplierService } from "../../services/supplierService";
import type { SupplierRecord, SupplierInput } from "../../types/supplier";
import { toast } from "../../pages/Toast";

interface SupplierSelectProps {
  value: string;
  supplierId?: string;
  onChange: (name: string, id?: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export const SupplierSelect: React.FC<SupplierSelectProps> = ({
  value,
  supplierId,
  onChange,
  placeholder = "Chọn hoặc nhập nhà cung cấp...",
  required = false,
  className = "",
  disabled = false,
}) => {
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Quick add modal
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickForm, setQuickForm] = useState<SupplierInput>({
    code: "",
    name: "",
    shortName: "",
    contactPerson: "",
    phone: "",
    email: "",
    taxCode: "",
    address: "",
    notes: "",
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const list = await supplierService.list({ activeOnly: true });
      setSuppliers(list);
    } catch (err) {
      console.error("Error loading suppliers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
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

  const filtered = suppliers.filter((s) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      (s.shortName && s.shortName.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q))
    );
  });

  const selectedSupplier =
    suppliers.find(
      (s) => (supplierId && s._id === supplierId) || s.name === value || (s.shortName && s.shortName === value),
    ) || null;

  const handleSelect = (sup: SupplierRecord) => {
    onChange(sup.name, sup._id);
    setIsOpen(false);
    setSearch("");
  };

  const handleOpenQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    const suggestedCode = `NCC-${Date.now().toString().slice(-4)}`;
    setQuickForm({
      code: suggestedCode,
      name: search.trim() || "",
      shortName: "",
      contactPerson: "",
      phone: "",
      email: "",
      taxCode: "",
      address: "",
      notes: "",
    });
    setShowQuickAdd(true);
    setIsOpen(false);
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!quickForm.name.trim()) {
      toast.error("Vui lòng nhập tên nhà cung cấp.");
      return;
    }
    if (!quickForm.code.trim()) {
      toast.error("Vui lòng nhập mã nhà cung cấp.");
      return;
    }

    setQuickAddLoading(true);
    try {
      const created = await supplierService.create(quickForm);
      setSuppliers((current) =>
        [...current.filter((supplier) => supplier._id !== created._id), created].sort((a, b) =>
          a.name.localeCompare(b.name, "vi"),
        ),
      );
      onChange(created.name, created._id);
      setShowQuickAdd(false);
      toast.success(`Đã thêm nhà cung cấp '${created.name}'!`);
    } catch (err: any) {
      toast.error(err.message || "Không thể tạo nhà cung cấp.");
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
          disabled
            ? "opacity-60 cursor-not-allowed bg-slate-100 border-slate-200"
            : "border-slate-200 hover:border-slate-300 shadow-2xs"
        } ${isOpen ? "ring-2 ring-emerald-500/20 border-emerald-500" : ""}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className={`truncate text-sm ${value ? "text-slate-800 font-medium" : "text-slate-400"}`}>
            {value || placeholder}
          </span>
          {selectedSupplier?.code && (
            <span className="hidden sm:inline text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
              {selectedSupplier.code}
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
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
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
                placeholder="Tìm tên, mã, số điện thoại..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <button
              type="button"
              onClick={handleOpenQuickAdd}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition shrink-0"
              title="Thêm nhà cung cấp mới"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm mới</span>
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-left">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-slate-400 gap-2 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Đang tải danh sách nhà cung cấp...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs text-slate-500">Không tìm thấy nhà cung cấp nào khớp với &quot;{search}&quot;</p>
                <button
                  type="button"
                  onClick={handleOpenQuickAdd}
                  className="mt-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tạo nhanh &quot;{search || "nhà cung cấp mới"}&quot;
                </button>
              </div>
            ) : (
              filtered.map((sup) => {
                const isSelected = (supplierId && sup._id === supplierId) || sup.name === value;
                return (
                  <div
                    key={sup._id}
                    onClick={() => handleSelect(sup)}
                    className={`p-2.5 flex items-center justify-between gap-2 cursor-pointer transition ${
                      isSelected ? "bg-emerald-50/70" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-sm font-semibold truncate ${isSelected ? "text-emerald-900" : "text-slate-800"}`}
                        >
                          {sup.name}
                        </span>
                        {sup.shortName && sup.shortName !== sup.name && (
                          <span className="text-xs text-slate-500 font-normal">({sup.shortName})</span>
                        )}
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {sup.code}
                        </span>
                      </div>

                      {(sup.contactPerson || sup.phone || sup.email) && (
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                          {sup.contactPerson && <span>LH: {sup.contactPerson}</span>}
                          {sup.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {sup.phone}
                            </span>
                          )}
                          {sup.email && (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {sup.email}
                            </span>
                          )}
                        </div>
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

      {/* Modal Thêm Nhanh Nhà Cung Cấp */}
      {showQuickAdd &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150 text-left">
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-base">Thêm nhanh Nhà cung cấp</h3>
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Mã nhà cung cấp *
                    </label>
                    <input
                      type="text"
                      required
                      value={quickForm.code}
                      onChange={(e) => setQuickForm({ ...quickForm, code: e.target.value.toUpperCase() })}
                      placeholder="vd: NCC-BBRAUN"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Tên viết tắt / Hãng
                    </label>
                    <input
                      type="text"
                      value={quickForm.shortName}
                      onChange={(e) => setQuickForm({ ...quickForm, shortName: e.target.value })}
                      placeholder="vd: B.Braun"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Tên nhà cung cấp đầy đủ *
                  </label>
                  <input
                    type="text"
                    required
                    value={quickForm.name}
                    onChange={(e) => setQuickForm({ ...quickForm, name: e.target.value })}
                    placeholder="vd: Công ty TNHH B.Braun Việt Nam"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Người liên hệ
                    </label>
                    <input
                      type="text"
                      value={quickForm.contactPerson}
                      onChange={(e) => setQuickForm({ ...quickForm, contactPerson: e.target.value })}
                      placeholder="vd: Nguyễn Văn A"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Số điện thoại
                    </label>
                    <input
                      type="text"
                      value={quickForm.phone}
                      onChange={(e) => setQuickForm({ ...quickForm, phone: e.target.value })}
                      placeholder="vd: 0901234567"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={quickForm.email}
                      onChange={(e) => setQuickForm({ ...quickForm, email: e.target.value })}
                      placeholder="contact@supplier.vn"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Mã số thuế
                    </label>
                    <input
                      type="text"
                      value={quickForm.taxCode}
                      onChange={(e) => setQuickForm({ ...quickForm, taxCode: e.target.value })}
                      placeholder="vd: 0101234567"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Địa chỉ
                  </label>
                  <input
                    type="text"
                    value={quickForm.address}
                    onChange={(e) => setQuickForm({ ...quickForm, address: e.target.value })}
                    placeholder="vd: KCN Định Trám, Việt Yên, Bắc Giang"
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
          </div>,
          document.body,
        )}
    </div>
  );
};
