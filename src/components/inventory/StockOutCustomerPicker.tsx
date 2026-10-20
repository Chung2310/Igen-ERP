import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Plus, Search, UserPlus, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { customerApi } from "../../modules/customer-management/customerApi";
import type { Customer } from "../../modules/customer-management/types";

type StockOutCustomerPickerProps = {
  customerId?: string;
  customerName: string;
  onChange: (next: { customerId?: string; customerName: string }) => void;
  disabled?: boolean;
};

export function StockOutCustomerPicker({ customerId, customerName, onChange, disabled = false }: StockOutCustomerPickerProps) {
  const { userProfile } = useAuth();
  const companyCode = userProfile?.companyCode?.trim().toUpperCase() || "";
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setCreateOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setCreateError("");
      return;
    }
    const timer = setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !companyCode) return;
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    customerApi
      .list({ companyCode, q: debouncedQuery || undefined, status: "active", page: 1, limit: 20 })
      .then((result) => {
        if (!cancelled) setCustomers(result.items);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Không tải được danh sách khách hàng.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyCode, debouncedQuery, isOpen]);

  const label = useMemo(() => customerName.trim(), [customerName]);

  const selectCustomer = (customer: Customer) => {
    onChange({ customerId: customer._id, customerName: customer.name });
    setIsOpen(false);
    setCreateOpen(false);
  };

  const handleCreate = async () => {
    const name = createName.trim();
    const phone = createPhone.trim();
    if (!name || !phone) {
      setCreateError("Vui lòng nhập tên và số điện thoại khách hàng.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const customer = await customerApi.create({ name, phone }, companyCode);
      setCreateName("");
      setCreatePhone("");
      setCreateOpen(false);
      selectCustomer(customer);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Tạo khách hàng thất bại.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((current) => !current)}
          className={`flex h-11 w-full min-w-0 items-center justify-between rounded-xl border border-[#DCE7F4] bg-white px-3 text-left text-sm outline-none transition focus:border-[#70D5FF] focus:ring-2 focus:ring-[#00ADFC]/15 disabled:cursor-not-allowed disabled:bg-slate-50 ${isOpen ? "border-[#70D5FF] ring-2 ring-[#00ADFC]/15" : ""}`}
        >
          <span className={`mr-2 flex-1 truncate ${label ? "font-medium text-slate-800" : "text-slate-400"}`}>
            {label || "Chọn khách hàng từ danh mục hoặc tạo mới"}
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-[#007EB8] transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
        {label && !disabled && (
          <button
            type="button"
            onClick={() => onChange({ customerId: undefined, customerName: "" })}
            title="Xóa khách hàng đã chọn"
            className="shrink-0 rounded-xl border border-[#DCE7F4] p-2 text-slate-400 hover:bg-[#F3FAFE] hover:text-[#007EB8]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 z-[100] mt-1.5 overflow-hidden rounded-2xl border border-[#DCE7F4] bg-white shadow-[0_16px_40px_rgba(11,65,99,0.2)]">
          <div className="relative flex items-center border-b border-[#E8F0F8] bg-[#F7FBFE] p-2">
            <Search className="absolute left-4 h-4 w-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tên, số điện thoại hoặc mã khách hàng..."
              className="w-full rounded-lg border border-[#DCE7F4] bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-[#70D5FF] focus:ring-2 focus:ring-[#00ADFC]/15"
            />
          </div>

          <div className="max-h-52 overflow-y-auto p-1.5">
            {!companyCode ? (
                  <p className="p-3 text-center text-sm text-slate-500">Không xác định được công ty của người dùng.</p>
            ) : loading ? (
              <p className="flex items-center justify-center gap-2 p-3 text-sm text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải khách hàng...
              </p>
            ) : loadError ? (
              <p className="p-3 text-center text-sm text-rose-600">{loadError}</p>
            ) : customers.length === 0 ? (
              <p className="p-3 text-center text-sm text-slate-500">Không tìm thấy khách hàng phù hợp.</p>
            ) : (
              customers.map((customer) => {
                const isSelected = customerId ? customer._id === customerId : customer.name === label;
                return (
                  <button
                    key={customer._id}
                    type="button"
                    onClick={() => selectCustomer(customer)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${isSelected ? "bg-[#E8F7FF] font-medium text-[#007EB8]" : "text-slate-700 hover:bg-[#F3FAFE]"}`}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {customer.name}
                      <span className="ml-2 font-normal text-slate-400">
                        {customer.phone}
                        {customer.customerCode ? ` · ${customer.customerCode}` : ""}
                      </span>
                    </span>
                    {isSelected && <Check className="ml-2 h-3.5 w-3.5 shrink-0 text-[#0098DD]" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-[#E8F0F8] bg-[#F7FBFE] p-2">
            {createOpen ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                    placeholder="Tên khách hàng"
                    className="h-10 w-full rounded-lg border border-[#DCE7F4] bg-white px-2.5 text-sm outline-none focus:border-[#70D5FF] focus:ring-2 focus:ring-[#00ADFC]/15"
                  />
                  <input
                    type="tel"
                    value={createPhone}
                    onChange={(event) => setCreatePhone(event.target.value)}
                    placeholder="Số điện thoại"
                    className="h-10 w-full rounded-lg border border-[#DCE7F4] bg-white px-2.5 text-sm outline-none focus:border-[#70D5FF] focus:ring-2 focus:ring-[#00ADFC]/15"
                  />
                </div>
                {createError && <p className="text-sm text-rose-600">{createError}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateOpen(false);
                      setCreateError("");
                    }}
                    className="rounded-lg border border-[#DCE7F4] bg-white px-3 py-2 text-sm text-slate-600 hover:bg-[#F3FAFE]"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={creating}
                    className="flex items-center gap-1.5 rounded-lg bg-[#00ADFC] px-3 py-2 text-sm font-medium text-white hover:bg-[#0098DD] disabled:opacity-60"
                  >
                    {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Tạo và chọn
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCreateName(query.trim());
                  setCreateOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#007EB8] hover:bg-[#E8F7FF]"
              >
                <UserPlus className="h-3.5 w-3.5" /> Tạo khách hàng mới
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
