import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useBranch } from "../../context/BranchContext";
import { authService } from "../../services/authService";
import type { UserProfile } from "../../types";

type StockOperatorPickerProps = {
  value: string;
  onChange: (name: string) => void;
  disabled?: boolean;
};

/**
 * Chọn người phụ trách từ danh sách tài khoản trong chi nhánh hiện tại.
 * Nếu tài khoản đang đăng nhập không có quyền đọc danh sách người dùng,
 * component tự chuyển về ô nhập tay để không chặn việc tạo phiếu.
 */
export function StockOperatorPicker({ value, onChange, disabled = false }: StockOperatorPickerProps) {
  const { userProfile } = useAuth();
  const { activeBranchId } = useBranch();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const companyCode = userProfile?.companyCode?.trim().toUpperCase() || "";
  const branchId = activeBranchId || userProfile?.branchId || "";

  useEffect(() => {
    if (!companyCode) {
      setUnavailable(true);
      return;
    }
    let cancelled = false;
    setLoading(true);
    authService
      .getUsersByCompany(companyCode, branchId || undefined)
      .then((result) => {
        if (cancelled) return;
        const active = result.filter((user) => user.isActive !== false && (user.displayName || "").trim());
        setUsers(active);
        setUnavailable(active.length === 0);
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [branchId, companyCode]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      return;
    }
    const timer = setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const filteredUsers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((user) =>
      [user.displayName, user.email, user.jobTitle].filter(Boolean).join(" ").toLowerCase().includes(keyword)
    );
  }, [query, users]);

  if (unavailable) {
    return (
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Nhập tên người phụ trách"
        className="h-11 w-full rounded-xl border border-[#DCE7F4] bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#70D5FF] focus:ring-2 focus:ring-[#00ADFC]/15"
      />
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        className={`flex h-11 w-full min-w-0 items-center justify-between rounded-xl border border-[#DCE7F4] bg-white px-3 text-left text-sm outline-none transition focus:border-[#70D5FF] focus:ring-2 focus:ring-[#00ADFC]/15 disabled:cursor-not-allowed disabled:bg-slate-50 ${isOpen ? "border-[#70D5FF] ring-2 ring-[#00ADFC]/15" : ""}`}
      >
        <span className={`mr-2 flex-1 truncate ${value ? "font-medium text-slate-800" : "text-slate-400"}`}>
          {value || "Chọn người phụ trách"}
        </span>
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />
        ) : (
          <ChevronDown className={`h-4 w-4 shrink-0 text-[#007EB8] transition-transform ${isOpen ? "rotate-180" : ""}`} />
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-[100] mt-1.5 overflow-hidden rounded-2xl border border-[#DCE7F4] bg-white shadow-[0_16px_40px_rgba(11,65,99,0.2)]">
          <div className="relative flex items-center border-b border-[#E8F0F8] bg-[#F7FBFE] p-2">
            <Search className="absolute left-4 h-4 w-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tên, email hoặc chức danh..."
              className="w-full rounded-lg border border-[#DCE7F4] bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-[#70D5FF] focus:ring-2 focus:ring-[#00ADFC]/15"
            />
          </div>

          <div className="max-h-52 overflow-y-auto p-1.5">
            {filteredUsers.length === 0 ? (
              <p className="p-3 text-center text-sm text-slate-500">Không tìm thấy tài khoản phù hợp.</p>
            ) : (
              filteredUsers.map((user) => {
                const name = (user.displayName || "").trim();
                const isSelected = name === value.trim();
                return (
                  <button
                    key={user.uid}
                    type="button"
                    onClick={() => {
                      onChange(name);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${isSelected ? "bg-[#E8F7FF] font-medium text-[#007EB8]" : "text-slate-700 hover:bg-[#F3FAFE]"}`}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {name}
                      <span className="ml-2 font-normal text-slate-400">{user.jobTitle || user.email}</span>
                    </span>
                    {isSelected && <Check className="ml-2 h-3.5 w-3.5 shrink-0 text-[#0098DD]" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
