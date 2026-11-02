import React from "react";
import { ChevronRight } from "lucide-react";
import type { RetailProduct } from "../../types";
import type { RetailOfficialCategory } from "../../api/retailProducts.api";

export interface PosCategoryDrilldownProps {
  selectedL1: string;
  selectedL2: string;
  selectedL3: string;
  setSelectedL1: (val: string) => void;
  setSelectedL2: (val: string) => void;
  setSelectedL3: (val: string) => void;
  level2Options: { name: string; count: number }[];
  level3Options: { name: string }[];
  products: RetailProduct[];
  officialCategories: RetailOfficialCategory[];
  getProductHierarchy: (product: RetailProduct) => [string, string, string];
}

export function PosCategoryDrilldown({
  selectedL1,
  selectedL2,
  selectedL3,
  setSelectedL1,
  setSelectedL2,
  setSelectedL3,
  level2Options,
  level3Options,
  products,
  officialCategories,
  getProductHierarchy,
}: PosCategoryDrilldownProps) {
  if (level2Options.length === 0 && selectedL1 === "all") {
    return null;
  }

  return (
    <div className="shrink-0 px-4 sm:px-6 pt-1 pb-2 space-y-2">
      {/* Row 1: Level 2 Pills (Hãng / Thương hiệu: Apple, Samsung, Xiaomi...) */}
      {level2Options.length > 0 && (
        <div
          role="tablist"
          aria-label="Danh mục mức 2"
          className="flex items-center gap-2 overflow-x-auto scrollbar-thin py-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedL2 === "all"}
            onClick={() => {
              setSelectedL2("all");
              setSelectedL3("all");
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer select-none shrink-0 ${
              selectedL2 === "all"
                ? "bg-gradient-to-r from-[#0866f5] to-[#7138f5] text-white shadow-xs font-bold"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
            }`}
          >
            Tất cả
          </button>
          {level2Options.map((item) => (
            <button
              key={item.name}
              type="button"
              role="tab"
              aria-selected={selectedL2 === item.name}
              onClick={() => {
                if (selectedL1 === "all") {
                  const sample = products.find((p) => {
                    const [, l2] = getProductHierarchy(p);
                    return l2 === item.name;
                  });
                  if (sample) {
                    const [l1] = getProductHierarchy(sample);
                    if (l1 && l1 !== "Chưa phân loại") {
                      setSelectedL1(l1);
                    }
                  } else {
                    const cat = officialCategories.find((c) => c.name === item.name);
                    if (cat && cat.parentCode) {
                      const parent = officialCategories.find((c) => c.code === cat.parentCode);
                      if (parent) setSelectedL1(parent.name);
                    }
                  }
                }
                setSelectedL2(item.name);
                setSelectedL3("all");
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer select-none shrink-0 ${
                selectedL2 === item.name
                  ? "bg-gradient-to-r from-[#0866f5] to-[#7138f5] text-white shadow-xs font-bold"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              <span>{item.name}</span>
              <span className="text-[11px] opacity-75">({item.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Row 2: Level 3 Pills (Dòng máy / Model: iPhone 16, iPhone 15...) */}
      {selectedL2 !== "all" && level3Options.length > 0 && (
        <div
          role="tablist"
          aria-label="Danh mục mức 3"
          className="flex items-center gap-2 overflow-x-auto scrollbar-thin py-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedL3 === "all"}
            onClick={() => setSelectedL3("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer select-none shrink-0 ${
              selectedL3 === "all"
                ? "bg-gradient-to-r from-[#0866f5] to-[#7138f5] text-white shadow-xs font-bold"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
            }`}
          >
            Tất cả
          </button>
          {level3Options.map((item) => (
            <button
              key={item.name}
              type="button"
              role="tab"
              aria-selected={selectedL3 === item.name}
              onClick={() => setSelectedL3(item.name)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer select-none shrink-0 ${
                selectedL3 === item.name
                  ? "bg-gradient-to-r from-[#0866f5] to-[#7138f5] text-white shadow-xs font-bold"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Row 3: Breadcrumb Trail (e.g. Tất cả › Điện thoại › Apple › iPhone 16) */}
      {(selectedL1 !== "all" || selectedL2 !== "all") && (
        <nav aria-label="Đường dẫn danh mục" className="flex items-center gap-1.5 text-xs text-slate-500 pt-0.5 font-medium">
          <button
            type="button"
            onClick={() => {
              setSelectedL1("all");
              setSelectedL2("all");
              setSelectedL3("all");
            }}
            className={`hover:text-[#0758d5] transition cursor-pointer ${
              selectedL1 === "all" ? "font-bold text-slate-800" : "hover:underline"
            }`}
          >
            Tất cả
          </button>

          {selectedL1 !== "all" && (
            <>
              <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />
              <button
                type="button"
                onClick={() => {
                  setSelectedL2("all");
                  setSelectedL3("all");
                }}
                className={`hover:text-[#0758d5] transition cursor-pointer ${
                  selectedL2 === "all" ? "font-bold text-slate-800" : "hover:underline"
                }`}
              >
                {selectedL1}
              </button>
            </>
          )}

          {selectedL2 !== "all" && (
            <>
              <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />
              <button
                type="button"
                onClick={() => setSelectedL3("all")}
                className={`hover:text-[#0758d5] transition cursor-pointer ${
                  selectedL3 === "all" ? "font-bold text-slate-800" : "hover:underline"
                }`}
              >
                {selectedL2}
              </button>
            </>
          )}

          {selectedL3 !== "all" && (
            <>
              <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />
              <span className="font-bold text-slate-800">{selectedL3}</span>
            </>
          )}
        </nav>
      )}
    </div>
  );
}

export interface PosBottomTabsProps {
  selectedL1: string;
  setSelectedL1: (val: string) => void;
  setSelectedL2: (val: string) => void;
  setSelectedL3: (val: string) => void;
  tabs: { key: string; name: string; icon: React.ReactNode }[];
}

export function PosBottomTabs({
  selectedL1,
  setSelectedL1,
  setSelectedL2,
  setSelectedL3,
  tabs,
}: PosBottomTabsProps) {
  return (
    <footer className="shrink-0 border-t border-[#dce9ff] bg-white px-3 sm:px-4 py-2 shadow-xs">
      <div
        role="tablist"
        aria-label="Danh mục mức 1"
        className="flex items-center gap-2 overflow-x-auto scrollbar-thin"
      >
        {tabs.map((tab) => {
          const active = selectedL1 === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                if (selectedL1 === tab.key) {
                  setSelectedL1("all");
                } else {
                  setSelectedL1(tab.key);
                }
                setSelectedL2("all");
                setSelectedL3("all");
              }}
              className={`flex-1 min-w-[90px] flex flex-col items-center justify-center gap-1 py-1.5 px-2 rounded-xl transition cursor-pointer select-none border text-center ${
                active
                  ? "bg-gradient-to-r from-[#0866f5] to-[#7138f5] text-white border-[#0866f5] shadow-xs shadow-[#0866f5]/20 font-bold"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              <span className={active ? "text-white" : "text-slate-500"}>
                {tab.icon}
              </span>
              <span className="text-xs sm:text-sm font-semibold truncate max-w-full">
                {tab.name}
              </span>
            </button>
          );
        })}
      </div>
    </footer>
  );
}
