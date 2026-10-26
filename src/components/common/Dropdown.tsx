import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check, Search, X, Plus } from "lucide-react";

export interface DropdownOption<T = string> {
  value: T;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export interface DropdownProps<T = string> {
  value: T;
  onChange: (value: T) => void;
  options: (DropdownOption<T> | T)[];
  placeholder?: string;
  label?: string;
  "aria-label"?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  variant?: "filter" | "default" | "form" | "subtle" | "ghost";
  size?: "xs" | "sm" | "md";
  searchable?: boolean;
  searchPlaceholder?: string;
  align?: "left" | "right";
  direction?: "down" | "up" | "auto";
  name?: string;
  id?: string;
  maxHeight?: string;
  actionButton?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    className?: string;
  };
}

export function Dropdown<T = string>({
  value,
  onChange,
  options,
  placeholder = "Chọn...",
  label,
  "aria-label": ariaLabel,
  disabled = false,
  className = "",
  triggerClassName = "",
  menuClassName = "",
  variant = "filter",
  size,
  searchable,
  searchPlaceholder = "Tìm kiếm...",
  align = "left",
  direction = "auto",
  name,
  id,
  maxHeight = "max-h-48",
  actionButton,
}: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(direction === "up");
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Recalculate opening direction
  useEffect(() => {
    if (direction === "up") {
      setOpenUpward(true);
      return;
    }
    if (direction === "down") {
      setOpenUpward(false);
      return;
    }
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dialogEl = containerRef.current.closest('[role="dialog"]');
      const bottomBoundary = dialogEl ? dialogEl.getBoundingClientRect().bottom : window.innerHeight;
      const topBoundary = dialogEl ? dialogEl.getBoundingClientRect().top : 0;
      const spaceBelow = bottomBoundary - rect.bottom;
      const spaceAbove = rect.top - topBoundary;
      if (spaceBelow < 190 && spaceAbove > spaceBelow) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }
  }, [isOpen, direction]);

  // Normalize options into DropdownOption format
  const normalizedOptions: DropdownOption<T>[] = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === "object" && opt !== null && "value" in opt) {
        return opt as DropdownOption<T>;
      }
      return {
        value: opt as T,
        label: String(opt),
      };
    });
  }, [options]);

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  // Automatically enable search if > 10 options, unless explicitly set
  const showSearch = searchable !== undefined ? searchable : normalizedOptions.length > 10;

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const query = searchQuery.toLowerCase().trim();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(query))
    );
  }, [normalizedOptions, searchQuery]);

  // Handle outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen && showSearch && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery("");
    }
  }, [isOpen, showSearch]);

  const handleSelect = (val: T) => {
    onChange(val);
    setIsOpen(false);
  };

  const effectiveSize = size || (variant === "form" ? "md" : "sm");

  // Size styles
  const sizeStyles = {
    xs: "min-h-[28px] px-2 py-1 text-[11px] gap-1",
    sm: "min-h-[34px] px-2.5 py-1.5 text-xs font-semibold gap-1.5",
    md: "min-h-[40px] px-3.5 py-2 text-sm font-normal gap-2",
  }[effectiveSize];

  // Variant styles
  const variantStyles = {
    filter: "rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20",
    default: "rounded-xl border border-slate-300 bg-white text-slate-800 shadow-2xs hover:border-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20",
    form: "rounded-xl border border-slate-300 bg-white text-slate-800 shadow-2xs hover:border-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20",
    subtle: "rounded-lg border border-transparent bg-slate-100 hover:bg-slate-200/70 text-slate-700",
    ghost: "rounded-lg hover:bg-slate-100 text-slate-700 border border-transparent",
  }[variant];

  const isFullWidth = className.includes("w-full") || className.includes("block") || variant === "form";

  return (
    <div
      ref={containerRef}
      className={`erp-dropdown relative text-left ${
        isFullWidth ? "w-full block min-w-0" : "inline-block"
      } ${className}`}
    >
      {label && (
        <label
          htmlFor={id}
          className="block mb-1 text-xs font-semibold text-slate-600 select-none"
        >
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-label={name ? undefined : (ariaLabel || label || (selectedOption ? selectedOption.label : placeholder))}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`inline-flex items-center justify-between transition-all duration-150 select-none cursor-pointer focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-100 ${variantStyles} ${sizeStyles} ${
          isFullWidth && !triggerClassName.includes("w-") ? "w-full" : ""
        } ${
          isOpen ? "border-cyan-500 ring-2 ring-cyan-500/20 bg-white" : ""
        } ${triggerClassName}`}
      >
        <span className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
          {selectedOption?.icon && (
            <span className="shrink-0 text-slate-400">{selectedOption.icon}</span>
          )}
          <span
            title={selectedOption ? selectedOption.label : placeholder}
            className={`truncate block min-w-0 text-left ${selectedOption ? "text-slate-800 font-medium" : "text-slate-400"}`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>

        <ChevronDown
          className={`${effectiveSize === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} shrink-0 text-slate-400 transition-transform duration-200 ml-1.5 ${
            isOpen ? "rotate-180 text-cyan-600" : ""
          }`}
        />
      </button>

      {/* Hidden select for form submissions, automated tests, and accessible references */}
      {name && (
        <select
          name={name}
          aria-label={ariaLabel}
          value={value as any}
          onChange={(e) => onChange(e.target.value as T)}
          tabIndex={-1}
          className="sr-only pointer-events-none absolute h-0 w-0 opacity-0"
        >
          {normalizedOptions.map((opt) => (
            <option key={String(opt.value)} value={opt.value as any}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {/* Dropdown Menu Popup */}
      {isOpen && (
        <div
          role="listbox"
          className={`absolute ${align === "right" ? "right-0" : "left-0"} ${
            openUpward ? "bottom-full mb-1.5 origin-bottom" : "top-full mt-1.5 origin-top"
          } z-50 ${
            isFullWidth
              ? "w-full min-w-full"
              : `${size === "xs" ? "min-w-[110px]" : "min-w-[160px]"} max-w-xs w-max`
          } rounded-xl border border-slate-200 bg-white p-1 shadow-xl ring-1 ring-black/5 overflow-hidden transition-all duration-150 animate-in fade-in zoom-in-95 ${menuClassName}`}
        >
          {/* Search input if enabled */}
          {showSearch && (
            <div className="relative mb-1 border-b border-slate-100 pb-1 pt-0.5 px-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg bg-slate-50 border border-slate-200 py-1 pl-7 pr-6 text-xs text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-cyan-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* Options List */}
          <div
            className={`overflow-y-auto overscroll-contain space-y-0.5 pr-1 ${maxHeight} dropdown-scrollbar`}
            style={{ scrollbarWidth: "thin" }}
          >
            {filteredOptions.length === 0 ? (
              <div className="py-2.5 px-3 text-center text-xs text-slate-400">
                Không tìm thấy lựa chọn
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt.value)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-40 ${
                      isSelected
                        ? "bg-cyan-50 font-bold text-cyan-800"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    } ${opt.className || ""}`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {opt.icon && (
                        <span className="shrink-0 text-slate-400">{opt.icon}</span>
                      )}
                      <div className="truncate">
                        <span className="block truncate">{opt.label}</span>
                        {opt.sublabel && (
                          <span className="block text-[10px] text-slate-400 truncate">
                            {opt.sublabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-cyan-600 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {actionButton && (
            <div className="pt-1 mt-1 border-t border-slate-100 px-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  actionButton.onClick();
                }}
                className={`flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 transition cursor-pointer select-none ${actionButton.className || ""}`}
              >
                {actionButton.icon || <Plus className="h-3.5 w-3.5 text-cyan-600" />}
                <span>{actionButton.label}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
