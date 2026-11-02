import React from "react";
import { Search, User, UserPlus, X } from "lucide-react";
import { customerApi } from "../../../customer-management/customerApi";
import type { RetailCustomer, RetailScope } from "../../types";
import CreateCustomerDialog from "./CreateCustomerDialog";
import { getApiErrorMessage } from "../../../../utils/errorMessage";

type Props = {
  scope: RetailScope;
  value: RetailCustomer | null;
  onChange: (customer: RetailCustomer | null) => void;
  collapsible?: boolean;
  onClose?: () => void;
  className?: string;
};

function formatPhoneMask(phone?: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\s+/g, "");
  if (cleaned.length >= 9) {
    return `${cleaned.slice(0, 4)} *** ${cleaned.slice(-3)}`;
  }
  return phone;
}

export default function CustomerPicker({
  scope,
  value,
  onChange,
  collapsible = false,
  onClose,
  className = "",
}: Props) {
  const [isOpen, setIsOpen] = React.useState(!collapsible);
  const [query, setQuery] = React.useState("");
  const [items, setItems] = React.useState<RetailCustomer[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [searchCompleted, setSearchCompleted] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    const q = query.trim();
    if (!q || value) { setItems([]); setSearchCompleted(false); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      setSearchCompleted(false);
      void customerApi.searchActive({ companyCode: scope.companyCode, q, limit: 10 })
        .then((result) => { if (active) { setItems(result.map((customer) => ({ _id: customer.customerId, customerCode: customer.customerCode, companyCode: scope.companyCode, type: customer.type, name: customer.name, phone: customer.phone, tier: customer.tier }))); setSearchCompleted(true); } })
        .catch((cause) => { if (active) { setItems([]); setSearchCompleted(false); setError(getApiErrorMessage(cause, "Không tìm được khách hàng.")); } })
        .finally(() => { if (active) setLoading(false); });
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, scope.companyCode, value?._id]);

  if (value) return (
    <div className={`flex items-center justify-between gap-2.5 rounded-xl border border-[#c2d7ff] bg-[#edf3ff]/70 px-3.5 py-2.5 text-slate-800 shadow-2xs transition hover:border-[#9ec1ff] ${className}`}>
      <div className="flex items-center gap-2 min-w-0">
        <User className="h-4 w-4 text-[#0866f5] shrink-0" />
        <span className="font-bold text-sm text-slate-800 truncate">{value.name}</span>
        {value.tier && (
          <span className="rounded-full bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 text-[10px] font-bold shrink-0">
            {value.tier.name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-mono text-xs text-slate-500">
          {formatPhoneMask(value.phone)}
        </span>
        <button
          type="button"
          aria-label="Bỏ chọn khách hàng"
          onClick={() => {
            setQuery("");
            setIsOpen(false);
            onChange(null);
            onClose?.();
          }}
          className="rounded-lg p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
          title="Bỏ chọn hoặc đổi khách"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );

  if (collapsible && !isOpen) {
    return (
      <div className={className}>
        <button
          type="button"
          aria-label="Tìm khách hàng"
          title="Tìm khách thành viên để tích điểm"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 w-full rounded-xl border border-dashed border-slate-300 hover:border-[#0866f5] bg-white hover:bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500 hover:text-[#0758d5] transition cursor-pointer shadow-2xs"
        >
          <Search className="h-4 w-4 text-[#0866f5] shrink-0" />
          <span className="truncate">Tìm khách thành viên để tích điểm (không bắt buộc)...</span>
        </button>
      </div>
    );
  }

  return <div className={`relative ${className}`}>
    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
    <input
      role="combobox"
      aria-label="Tìm khách hàng"
      aria-expanded={items.length > 0}
      className={`w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 ${collapsible || onClose ? "pr-8" : "pr-3"} text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 hover:border-slate-300 focus:border-[#0866f5] focus:outline-none focus:ring-2 focus:ring-[#0866f5]/20 transition shadow-2xs`}
      placeholder="Tìm khách thành viên để tích điểm (không bắt buộc)..."
      value={query}
      onChange={(event) => { setQuery(event.target.value); setSearchCompleted(false); }}
    />
    {(collapsible || onClose) && (
      <button
        type="button"
        aria-label="Đóng tìm kiếm"
        onClick={() => {
          setIsOpen(false);
          setQuery("");
          setItems([]);
          onClose?.();
        }}
        className="absolute right-2.5 top-2.5 p-0.5 text-slate-400 hover:text-slate-600 transition cursor-pointer rounded-md hover:bg-slate-100"
        title="Đóng tìm kiếm"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    )}
    {loading && <p className="mt-1 text-xs text-slate-500">Đang tìm khách hàng...</p>}
    {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    {!loading && query.trim() && !error && searchCompleted && items.length === 0 && (
      <div className="mt-2 rounded-xl border border-dashed border-[#9ec1ff] bg-[#edf3ff]/60 p-3 shadow-2xs">
        <p className="text-xs text-slate-600">Không tìm thấy khách hàng thành viên.</p>
        <button
          type="button"
          aria-label="Tạo khách hàng mới"
          className="mt-2 flex items-center gap-2 text-xs font-bold text-[#0758d5] hover:text-[#0844a8] cursor-pointer"
          onClick={() => setCreating(true)}
        >
          <UserPlus className="h-4 w-4" />
          <span>Tạo khách hàng mới</span>
        </button>
      </div>
    )}
    {items.length > 0 && (
      <div role="listbox" className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl scrollbar-thin">
        {items.map((customer) => (
          <button
            type="button"
            role="option"
            aria-selected="false"
            aria-label={`${customer.name} ${customer.customerCode} ${customer.phone || ""}`}
            key={customer._id}
            className="flex items-center justify-between w-full rounded-lg px-3 py-2 text-left hover:bg-[#edf3ff] transition text-slate-800 cursor-pointer"
            onClick={() => { onChange(customer); setItems([]); setQuery(""); }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <p className="font-semibold text-xs text-slate-800 truncate">{customer.name}</p>
              {customer.tier && <span className="rounded-full bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 text-[10px] font-bold shrink-0">{customer.tier.name}</span>}
            </div>
            <p className="font-mono text-xs text-slate-500 shrink-0">{formatPhoneMask(customer.phone) || customer.customerCode}</p>
          </button>
        ))}
      </div>
    )}
    {creating && (() => {
      const trimmedQuery = query.trim();
      const isName = /\p{L}/u.test(trimmedQuery);
      return (
        <CreateCustomerDialog
          scope={scope}
          initialPhone={isName ? "" : trimmedQuery}
          initialName={isName ? trimmedQuery : ""}
          onClose={() => setCreating(false)}
          onCreated={(customer) => {
            setQuery("");
            setItems([]);
            setSearchCompleted(false);
            setCreating(false);
            onChange(customer);
          }}
        />
      );
    })()}
  </div>;
}
