import React from "react";
import { LayoutGrid, List } from "lucide-react";

export type ViewMode = "grid" | "list";

type ViewToggleProps = {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
};

export function ViewToggle({ mode, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-slate-50 p-1 shrink-0">
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={`rounded-md p-1.5 transition-all ${
          mode === "grid"
            ? "bg-white text-blue-600 shadow-2xs font-bold"
            : "text-gray-400 hover:text-gray-600"
        }`}
        title="Xem dạng lưới (Card)"
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`rounded-md p-1.5 transition-all ${
          mode === "list"
            ? "bg-white text-blue-600 shadow-2xs font-bold"
            : "text-gray-400 hover:text-gray-600"
        }`}
        title="Xem dạng danh sách (Text)"
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  );
}
