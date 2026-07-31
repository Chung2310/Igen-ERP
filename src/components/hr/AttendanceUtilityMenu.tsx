import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, FileSpreadsheet } from "lucide-react";

type AttendanceUtilityMenuProps = {
  onExportCoefficients: () => void;
  disabled?: boolean;
};

export default function AttendanceUtilityMenu({
  onExportCoefficients,
  disabled = false,
}: AttendanceUtilityMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, []);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer border-0 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Tiện ích
        <ChevronDown
          aria-hidden="true"
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 min-w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onExportCoefficients)}
            className="flex w-full items-center gap-2 rounded-lg border-0 bg-transparent px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet
              aria-hidden="true"
              className="h-4 w-4 text-emerald-600"
            />
            Xuất bảng số công
          </button>
        </div>
      )}
    </div>
  );
}
