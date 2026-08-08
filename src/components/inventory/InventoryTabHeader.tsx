import React from "react";
import type { InventorySubTabType } from "../../types";
import { inventoryTabs } from "./data";

type InventoryTabHeaderProps = {
  subTab: InventorySubTabType;
  onChangeTab: (tab: InventorySubTabType) => void;
};

export function InventoryTabHeader({ subTab, onChangeTab }: InventoryTabHeaderProps) {
  return (
    <div className="flex shrink-0 justify-between border-b border-gray-200 bg-gray-50/50 p-2 text-xs" id="inventory_tabs_switch">
      <div className="flex flex-wrap gap-2">
        {inventoryTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => onChangeTab(tab)}
            className={`rounded-lg border px-4 py-2 font-bold uppercase tracking-wide transition-all ${subTab === tab ? "border-slate-800 bg-slate-800 text-white shadow-xs" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-100"
              }`}
          >
            {tab}
          </button>
        ))}
      </div>
      
    </div>
  );
}
