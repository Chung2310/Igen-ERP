import React from "react";
import { Package, X, Search } from "lucide-react";
import type { RetailProduct } from "../../types";

export type ProductGroup = { key: string; name: string; variants: RetailProduct[] };

interface ProductVariantSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: ProductGroup;
  onAdd: (product: RetailProduct) => void;
}

const ATTRIBUTE_LABELS: Record<string, string> = {
  STORAGE: "Dung lượng",
  COLOR: "Màu",
  CONDITION: "Tình trạng",
  ORIGIN: "Phiên bản",
  RAM: "RAM",
};

const ATTRIBUTE_ORDER = ["STORAGE", "COLOR", "CONDITION", "ORIGIN", "RAM"];

const COLOR_HEX_MAP: Record<string, string> = {
  "titan đen": "#27272a",
  "titan trắng": "#f4f4f5",
  "titan sa mạc": "#c5a078",
  "titan tự nhiên": "#9a9a9f",
  "đen": "#18181b",
  "black": "#18181b",
  "trắng": "#fafafa",
  "white": "#fafafa",
  "bạc": "#e4e4e7",
  "silver": "#e4e4e7",
  "xám": "#52525b",
  "gray": "#52525b",
  "vàng": "#eab308",
  "gold": "#eab308",
  "hồng": "#f472b6",
  "pink": "#f472b6",
  "xanh": "#2563eb",
  "blue": "#2563eb",
  "xanh dương": "#1d4ed8",
  "xanh lá": "#22c55e",
  "green": "#22c55e",
  "tím": "#a855f7",
  "purple": "#a855f7",
  "đỏ": "#ef4444",
  "red": "#ef4444",
};

function getColorHex(name: string): string | null {
  const lower = name.toLowerCase().trim();
  for (const [key, hex] of Object.entries(COLOR_HEX_MAP)) {
    if (lower.includes(key)) return hex;
  }
  return null;
}

function formatVnd(val: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(val)}đ`;
}

type ParsedVariant = {
  raw: RetailProduct;
  attributes: Record<string, string>;
};

function parseVariantAttributes(variant: RetailProduct): Record<string, string> {
  const attrs: Record<string, string> = {};

  // 1. From optionValues if available
  if (variant.optionValues && variant.optionValues.length > 0) {
    for (const opt of variant.optionValues) {
      if (opt.code && opt.value) {
        attrs[opt.code.toUpperCase()] = opt.value.trim();
      }
    }
  }

  // 2. From attributes array if available
  if (variant.attributes && variant.attributes.length > 0) {
    for (const attr of variant.attributes) {
      if (attr.code && attr.value) {
        const key = attr.code.toUpperCase();
        if (!attrs[key]) {
          attrs[key] = attr.value.trim();
        }
      }
    }
  }

  // If already populated from structured data, return early
  if (Object.keys(attrs).length > 0) {
    return attrs;
  }

  // 3. Fallback: Parse from variantName or displayName string
  const text = variant.variantName || "";
  if (text) {
    const segments = text
      .split(/[·•,\-|/]/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (let i = 0; i < segments.length; i++) {
      const part = segments[i];

      // Storage: 128GB, 256GB, 512GB, 1TB...
      if (/(\d+)\s*(GB|TB|mb)/i.test(part) && !attrs.STORAGE) {
        attrs.STORAGE = part;
        continue;
      }

      // Color
      if (
        /(titan|đen|trắng|vàng|bạc|xám|hồng|xanh|tím|gold|silver|black|white|blue|purple|pink)/i.test(
          part,
        ) &&
        !attrs.COLOR
      ) {
        attrs.COLOR = part;
        continue;
      }

      // Condition: Mới 100%, Like new, 99%, Cũ...
      if (
        /(mới|like[\s-]?new|99%|98%|95%|cũ|active|seal|trưng bày)/i.test(part) &&
        !attrs.CONDITION
      ) {
        attrs.CONDITION = part;
        continue;
      }

      // Origin / Version: VN/A, Quốc tế, LL/A...
      if (
        /(vn\/a|ll\/a|za\/a|ja\/a|quốc tế|chính hãng|lock)/i.test(part) &&
        !attrs.ORIGIN
      ) {
        attrs.ORIGIN = part;
        continue;
      }

      // Generic positional fallback
      const key = `ATTR_${i + 1}`;
      if (!attrs[key]) {
        attrs[key] = part;
      }
    }
  }

  // If still empty, use variantName itself as a single attribute
  if (Object.keys(attrs).length === 0 && text) {
    attrs.EDITION = text;
  }

  return attrs;
}

export function ProductVariantSelectorModal({
  isOpen,
  onClose,
  group,
  onAdd,
}: ProductVariantSelectorModalProps) {
  const [activeTab, setActiveTab] = React.useState<"attributes" | "sku_list">("attributes");
  const [skuFilter, setSkuFilter] = React.useState("");

  // Parse all variants in the group
  const parsedVariants: ParsedVariant[] = React.useMemo(() => {
    return group.variants.map((variant) => ({
      raw: variant,
      attributes: parseVariantAttributes(variant),
    }));
  }, [group.variants]);

  // Extract all attribute definitions across variants
  const attributeDefinitions = React.useMemo(() => {
    const map = new Map<string, Set<string>>();

    for (const pv of parsedVariants) {
      for (const [key, val] of Object.entries(pv.attributes)) {
        if (!map.has(key)) map.set(key, new Set());
        map.get(key)!.add(val);
      }
    }

    const result: Array<{ key: string; name: string; values: string[] }> = [];

    // Order known attributes first
    for (const key of ATTRIBUTE_ORDER) {
      if (map.has(key)) {
        const rawValues = Array.from(map.get(key)!);
        // Sort storage numerically
        if (key === "STORAGE") {
          rawValues.sort((a, b) => {
            const numA = parseInt(a, 10) * (a.toUpperCase().includes("TB") ? 1024 : 1);
            const numB = parseInt(b, 10) * (b.toUpperCase().includes("TB") ? 1024 : 1);
            return numA - numB;
          });
        }
        result.push({
          key,
          name: ATTRIBUTE_LABELS[key] || key,
          values: rawValues,
        });
        map.delete(key);
      }
    }

    // Add any remaining custom attributes
    for (const [key, valSet] of map.entries()) {
      result.push({
        key,
        name: ATTRIBUTE_LABELS[key] || (key.startsWith("ATTR_") ? `Thuộc tính` : key),
        values: Array.from(valSet),
      });
    }

    return result;
  }, [parsedVariants]);

  // Initial selection: Default to first in-stock variant or first variant
  const [selectedAttributes, setSelectedAttributes] = React.useState<Record<string, string>>(() => {
    const defaultVariant =
      parsedVariants.find((pv) => pv.raw.stock > 0) || parsedVariants[0];
    return defaultVariant ? { ...defaultVariant.attributes } : {};
  });

  // Re-initialize selection when group changes
  React.useEffect(() => {
    const defaultVariant =
      parsedVariants.find((pv) => pv.raw.stock > 0) || parsedVariants[0];
    if (defaultVariant) {
      setSelectedAttributes({ ...defaultVariant.attributes });
    }
    setSkuFilter("");
  }, [group, parsedVariants]);

  // Find currently matched variant
  const matchedVariant = React.useMemo(() => {
    // 1. Exact match
    const exact = parsedVariants.find((pv) =>
      Object.entries(selectedAttributes).every(([k, v]) => pv.attributes[k] === v),
    );
    if (exact) return exact.raw;

    // 2. Best partial match
    let bestScore = -1;
    let bestVariant = group.variants[0];
    for (const pv of parsedVariants) {
      let score = 0;
      for (const [k, v] of Object.entries(selectedAttributes)) {
        if (pv.attributes[k] === v) score += 1;
      }
      if (pv.raw.stock > 0) score += 0.5;
      if (score > bestScore) {
        bestScore = score;
        bestVariant = pv.raw;
      }
    }
    return bestVariant;
  }, [parsedVariants, selectedAttributes, group.variants]);

  // Resolve a full selection when the cashier picks `key = val`:
  // keep attributes above it, then for each attribute below keep the current
  // choice if it still has stock, otherwise jump to the first value with stock.
  const resolveSelection = React.useCallback(
    (key: string, val: string): Record<string, string> => {
      const order = attributeDefinitions.map((a) => a.key);
      const keyIndex = order.indexOf(key);
      const next: Record<string, string> = {};
      for (let i = 0; i < keyIndex; i++) {
        const k = order[i];
        if (selectedAttributes[k] !== undefined) next[k] = selectedAttributes[k];
      }
      next[key] = val;

      const prefixMatches = parsedVariants.filter((pv) =>
        Object.entries(next).every(([nk, nv]) => pv.attributes[nk] === nv),
      );
      if (prefixMatches.length === 0 || !prefixMatches.some((pv) => pv.raw.stock > 0)) {
        // Value not sellable under current upper choices: jump to the closest
        // in-stock variant having this value (keeps as many current choices as possible).
        let best: ParsedVariant | undefined;
        let bestScore = -1;
        for (const pv of parsedVariants) {
          if (pv.attributes[key] !== val) continue;
          let score = pv.raw.stock > 0 ? 100 : 0;
          for (const [k, v] of Object.entries(selectedAttributes)) {
            if (pv.attributes[k] === v) score += 1;
          }
          if (score > bestScore) {
            bestScore = score;
            best = pv;
          }
        }
        if (best && (best.raw.stock > 0 || prefixMatches.length === 0)) {
          return { ...best.attributes };
        }
      }

      for (let i = keyIndex + 1; i < order.length; i++) {
        const k = order[i];
        const candidates = parsedVariants.filter((pv) =>
          Object.entries(next).every(([nk, nv]) => pv.attributes[nk] === nv),
        );
        if (candidates.length === 0) break;
        const current = selectedAttributes[k];
        const keepCurrent = candidates.some(
          (pv) => pv.attributes[k] === current && pv.raw.stock > 0,
        );
        if (keepCurrent) {
          next[k] = current;
          continue;
        }
        const pick =
          candidates.find((pv) => pv.raw.stock > 0 && pv.attributes[k]) ||
          candidates.find((pv) => pv.attributes[k]);
        if (pick) next[k] = pick.attributes[k];
      }
      return next;
    },
    [attributeDefinitions, parsedVariants, selectedAttributes],
  );

  // Cascading availability: an attribute is only filtered by the choices ABOVE it,
  // so the top row always shows the full picture and lower rows narrow down.
  type OptionState = "selected" | "available" | "switch" | "soldout";
  const getOptionInfo = React.useCallback(
    (
      attrIndex: number,
      key: string,
      val: string,
    ): { state: OptionState; stock: number; hint: string } => {
      const prefix = attributeDefinitions.slice(0, attrIndex).map((a) => a.key);
      const matchesPrefix = (pv: ParsedVariant) =>
        prefix.every(
          (k) => selectedAttributes[k] === undefined || pv.attributes[k] === selectedAttributes[k],
        );

      const prefixStock = parsedVariants
        .filter((pv) => pv.attributes[key] === val && matchesPrefix(pv))
        .reduce((sum, pv) => sum + Math.max(0, pv.raw.stock), 0);
      const totalStock = parsedVariants
        .filter((pv) => pv.attributes[key] === val)
        .reduce((sum, pv) => sum + Math.max(0, pv.raw.stock), 0);

      if (selectedAttributes[key] === val) {
        return { state: "selected", stock: prefixStock, hint: "" };
      }
      if (prefixStock > 0) {
        return { state: "available", stock: prefixStock, hint: `Còn ${prefixStock} máy` };
      }
      if (totalStock > 0) {
        const preview = resolveSelection(key, val);
        const changes = attributeDefinitions
          .filter((a) => a.key !== key && preview[a.key] && preview[a.key] !== selectedAttributes[a.key])
          .map((a) => `${a.name} → ${preview[a.key]}`);
        return {
          state: "switch",
          stock: totalStock,
          hint: changes.length
            ? `Còn ${totalStock} máy ở phiên bản khác. Sẽ đổi: ${changes.join(", ")}`
            : `Còn ${totalStock} máy ở phiên bản khác`,
        };
      }
      return { state: "soldout", stock: 0, hint: "Hết hàng tất cả phiên bản" };
    },
    [attributeDefinitions, parsedVariants, selectedAttributes, resolveSelection],
  );

  const handleSelectAttribute = (key: string, val: string) => {
    setSelectedAttributes(resolveSelection(key, val));
  };

  // Filtered variants for SKU List tab
  const filteredSkuList = React.useMemo(() => {
    const query = skuFilter.trim().toLowerCase();
    const list = query
      ? group.variants.filter((v) => {
          const text = `${v.sku} ${v.name} ${v.variantName || ""} ${v.barcode || ""}`.toLowerCase();
          return text.includes(query);
        })
      : [...group.variants];
    // In-stock first so the cashier sees sellable machines immediately
    return list.sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0));
  }, [group.variants, skuFilter]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Chọn chi tiết SKU ${group.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex w-full max-w-[500px] flex-col rounded-3xl border border-slate-200 bg-white text-slate-800 shadow-2xl overflow-hidden max-h-[92vh]">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 sm:px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edf3ff] text-[#0866f5]"><Package className="h-4 w-4" /></span>
            <h3 className="max-w-[200px] truncate text-base font-extrabold text-slate-900 sm:text-lg">{group.name}</h3>
          </div>

          <div className="flex items-center gap-2">
            {/* TABS: Theo thuộc tính | Danh sách SKU */}
            <div className="inline-flex rounded-xl bg-slate-200/70 p-0.5 border border-slate-200/80 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("attributes")}
                className={`rounded-lg px-2.5 sm:px-3 py-1 font-medium transition cursor-pointer select-none ${
                  activeTab === "attributes"
                    ? "bg-white text-[#0844a8] font-bold shadow-xs border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Theo thuộc tính
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("sku_list")}
                className={`rounded-lg px-2.5 sm:px-3 py-1 font-medium transition cursor-pointer select-none ${
                  activeTab === "sku_list"
                    ? "bg-white text-[#0844a8] font-bold shadow-xs border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Danh sách SKU
              </button>
            </div>

            {/* CLOSE BUTTON */}
            <button
              type="button"
              aria-label="Đóng"
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 scrollbar-thin">
          {activeTab === "attributes" ? (
            /* TAB 1: THEO THUỘC TÍNH */
            <div className="space-y-3.5">
              {/* LEGEND */}
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 rounded-xl bg-slate-50 border border-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Còn hàng
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full border border-dashed border-amber-500" /> Có ở phiên bản khác
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-300" /> Hết hàng
                </span>
              </div>

              {attributeDefinitions.map((attr, attrIndex) => (
                <div key={attr.key} className="space-y-1.5">
                  <span className="block text-xs font-bold text-slate-700">
                    {attr.name}
                  </span>

                  <div className="flex flex-wrap gap-2">
                    {attr.values.map((val) => {
                      const { state, stock, hint } = getOptionInfo(attrIndex, attr.key, val);
                      const isSelected = state === "selected";
                      const colorHex = attr.key === "COLOR" ? getColorHex(val) : null;

                      const chipClass = {
                        selected:
                          "border-[#0866f5] bg-[#edf3ff] text-[#0844a8] font-bold ring-2 ring-[#0866f5]/20 shadow-xs",
                        available:
                          "border-slate-300 bg-white text-slate-800 font-semibold shadow-2xs hover:border-[#6b9dff] hover:bg-[#edf3ff]/40",
                        switch:
                          "border-dashed border-amber-300 bg-amber-50/40 text-slate-600 font-medium hover:border-amber-400 hover:bg-amber-50",
                        soldout:
                          "border-slate-200 bg-slate-50 text-slate-400 font-medium cursor-not-allowed",
                      }[state];

                      const badgeClass = {
                        selected: "bg-[#0866f5] text-white",
                        available: "bg-emerald-100 text-emerald-700",
                        switch: "bg-amber-100 text-amber-700",
                        soldout: "bg-slate-200 text-slate-500",
                      }[state];

                      return (
                        <button
                          key={val}
                          type="button"
                          aria-label={val}
                          title={hint || undefined}
                          disabled={state === "soldout"}
                          onClick={() => handleSelectAttribute(attr.key, val)}
                          className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition select-none ${
                            state === "soldout" ? "" : "cursor-pointer active:scale-[0.97]"
                          } ${chipClass}`}
                        >
                          {colorHex && (
                            <span
                              aria-hidden="true"
                              className={`h-3.5 w-3.5 rounded-full shrink-0 border ${
                                isSelected ? "border-[#0866f5]" : "border-slate-300"
                              } ${state === "soldout" ? "opacity-40" : ""}`}
                              style={{ backgroundColor: colorHex }}
                            />
                          )}
                          <span className={state === "soldout" ? "line-through" : ""}>{val}</span>
                          <span
                            aria-hidden="true"
                            className={`min-w-[18px] rounded-md px-1 text-center text-[10px] font-bold leading-4 ${badgeClass}`}
                          >
                            {state === "soldout" ? "Hết" : stock}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* TAB 2: DANH SÁCH SKU */
            <div className="space-y-2.5">
              {/* SEARCH INPUT */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={skuFilter}
                  onChange={(e) => setSkuFilter(e.target.value)}
                  placeholder="Lọc: 256, đen, like new..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-[#0866f5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0866f5]/20 transition"
                />
              </div>

              {/* SKU LIST */}
              <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-slate-50/40 p-1.5 scrollbar-thin">
                {filteredSkuList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    Không tìm thấy SKU nào phù hợp
                  </div>
                ) : (
                  filteredSkuList.map((v) => {
                    const isSoldOut = v.stock <= 0;
                    return (
                      <div
                        key={v._id}
                        className="flex items-center justify-between py-2 px-2.5 transition hover:bg-white hover:shadow-2xs rounded-xl"
                      >
                        <div className="min-w-0 flex-1 pr-3">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {v.variantName || v.name}
                          </p>
                          <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                            {v.sku} ·{" "}
                            {isSoldOut ? (
                              <span className="text-rose-600 font-semibold">Hết hàng</span>
                            ) : (
                              <span className="text-emerald-700 font-semibold">
                                Còn {v.stock}
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-bold font-mono text-slate-900">
                            {formatVnd(v.price)}
                          </span>

                          <button
                            type="button"
                            disabled={isSoldOut}
                            onClick={() => {
                              onAdd(v);
                              onClose();
                            }}
                            className="rounded-xl bg-[#edf3ff] hover:bg-[#0866f5] text-[#0758d5] hover:text-white border border-[#c2d7ff] hover:border-[#0866f5] active:scale-95 px-3 py-1.5 text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                          >
                            Thêm
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER (ONLY ON ATTRIBUTES TAB) */}
        {activeTab === "attributes" && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-4 sm:px-5 py-3.5">
            <div className="min-w-0 flex-1 pr-3">
              <p className="text-xs text-slate-500 truncate font-mono">
                {matchedVariant.sku} · {matchedVariant.variantName || matchedVariant.name}
              </p>

              <div className="flex items-baseline gap-2.5 mt-0.5">
                <span className="text-lg sm:text-xl font-black font-mono text-slate-900">
                  {formatVnd(matchedVariant.price)}
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                    matchedVariant.stock > 0
                      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                      : "text-rose-700 bg-rose-50 border-rose-200"
                  }`}
                >
                  {matchedVariant.stock > 0
                    ? `Còn ${matchedVariant.stock} tại quầy`
                    : "Hết hàng tại quầy"}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={matchedVariant.stock <= 0}
              onClick={() => {
                onAdd(matchedVariant);
                onClose();
              }}
              className="shrink-0 rounded-2xl bg-[#0866f5] hover:bg-[#0758d5] active:scale-95 px-5 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-[#0866f5]/25 transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              Thêm vào giỏ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
export default ProductVariantSelectorModal;
