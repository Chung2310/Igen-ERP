import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, ChevronDown, Check, Building2, AlertCircle } from "lucide-react";
import { departmentService, DepartmentRecord } from "../../services/departmentService";

interface DepartmentSelectProps {
  value: string;
  departmentId?: string;
  onChange: (name: string, id?: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const normalize = (str: string) =>
  str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export const DepartmentSelect: React.FC<DepartmentSelectProps> = ({
  value,
  departmentId,
  onChange,
  placeholder = "Chọn phòng ban...",
  className = "",
  disabled = false,
}) => {
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    departmentService
      .list()
      .then((data) => {
        if (isMounted) setDepartments(data);
      })
      .catch((err) => console.error("Error fetching departments:", err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
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
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const selectedDepartment = useMemo(() => {
    if (departmentId) {
      const found = departments.find((d) => d._id === departmentId);
      if (found) return found;
    }
    if (value) {
      return departments.find((d) => d.name.toLowerCase() === value.trim().toLowerCase());
    }
    return null;
  }, [departments, departmentId, value]);

  const isLegacyValue = Boolean(value && !selectedDepartment);

  const filteredDepartments = useMemo(() => {
    const q = normalize(search);
    return departments.filter((dept) => {
      // Chỉ hiển thị phòng đang active hoặc phòng đang được chọn hiện tại
      const isCurrentSelected =
        dept._id === departmentId || dept.name.toLowerCase() === value.trim().toLowerCase();
      if (!dept.isActive && !isCurrentSelected) return false;

      if (!q) return true;
      return (
        normalize(dept.name).includes(q) ||
        normalize(dept.code).includes(q) ||
        (dept.managerName && normalize(dept.managerName).includes(q))
      );
    });
  }, [departments, search, departmentId, value]);

  const handleSelect = (dept: DepartmentRecord) => {
    onChange(dept.name, dept._id);
    setIsOpen(false);
    setSearch("");
  };

  const displayText = selectedDepartment
    ? selectedDepartment.name
    : value
    ? value
    : "";

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2 text-left bg-slate-50 border rounded-xl text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
          disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-slate-100/70"
        } ${isLegacyValue ? "border-amber-400 bg-amber-50/40 text-amber-900" : "border-slate-200 text-slate-800"}`}
      >
        <div className="flex items-center gap-2 truncate">
          <Building2 className={`w-4 h-4 shrink-0 ${isLegacyValue ? "text-amber-500" : "text-slate-400"}`} />
          {displayText ? (
            <span className="truncate font-medium">
              {displayText}
              {selectedDepartment && !selectedDepartment.isActive && (
                <span className="ml-2 text-xs text-rose-500 font-normal">[Ngừng hoạt động]</span>
              )}
              {isLegacyValue && (
                <span className="ml-2 text-xs text-amber-600 font-normal flex-inline items-center gap-1">
                  (Cũ / Chưa chuẩn hóa)
                </span>
              )}
            </span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Tìm mã hoặc tên phòng ban..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto p-1 divide-y divide-slate-50">
            {isLegacyValue && (
              <div className="p-2 bg-amber-50/60 rounded-lg mb-1 flex items-start gap-2 border border-amber-200 text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Giá trị hiện tại: "{value}"</span>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Chưa được gán vào danh mục chuẩn. Vui lòng chọn một phòng ban chuẩn bên dưới để đồng bộ dữ liệu.
                  </p>
                </div>
              </div>
            )}

            {loading ? (
              <div className="py-4 text-center text-xs text-slate-400">Đang tải danh mục...</div>
            ) : filteredDepartments.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                Không tìm thấy phòng ban phù hợp
              </div>
            ) : (
              filteredDepartments.map((dept) => {
                const isSelected =
                  dept._id === selectedDepartment?._id ||
                  dept.name.toLowerCase() === value.trim().toLowerCase();
                return (
                  <button
                    key={dept._id}
                    type="button"
                    onClick={() => handleSelect(dept)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left rounded-lg text-xs transition cursor-pointer ${
                      isSelected
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold text-slate-900">{dept.name}</span>
                        <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-slate-100 text-slate-600 rounded">
                          {dept.code}
                        </span>
                        {!dept.isActive && (
                          <span className="px-1 py-0.2 text-[9px] bg-rose-50 text-rose-600 rounded">
                            Ngừng
                          </span>
                        )}
                      </div>
                      {dept.description && (
                        <span className="text-[11px] text-slate-400 truncate mt-0.5">
                          {dept.description}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
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
