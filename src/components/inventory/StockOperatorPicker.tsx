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
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
      />
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        className={`flex h-11 w-full min-w-0 items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-left text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-50 ${isOpen ? "border-teal-600 ring-2 ring-teal-100" : ""}`}
      >
        <span className={`mr-2 flex-1 truncate ${value ? "font-medium text-slate-800" : "text-slate-400"}`}>
          {value || "Chọn người phụ trách"}
        </span>
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />
        ) : (
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-[100] mt-1.5 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-xl">
          <div className="relative flex items-center border-b border-slate-100 bg-slate-50/50 p-2">
            <Search className="absolute left-4 h-4 w-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tên, email hoặc chức danh..."
              className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <div className="max-h-52 overflow-y-auto p-1.5">
            {filteredUsers.length === 0 ? (
              <p className="p-3 text-center text-xs text-slate-400">Không tìm thấy tài khoản phù hợp.</p>
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
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors ${isSelected ? "bg-teal-50 font-bold text-teal-700" : "text-slate-700 hover:bg-slate-50"}`}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {name}
                      <span className="ml-2 font-normal text-slate-400">{user.jobTitle || user.email}</span>
                    </span>
                    {isSelected && <Check className="ml-2 h-3.5 w-3.5 shrink-0 text-teal-600" />}
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
