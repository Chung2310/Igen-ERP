import React from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Check, Loader2, ScanBarcode, Search, ShoppingCart, X } from "lucide-react";
import { inventorySerialService, type InventorySerialUnit } from "../../../../services/inventorySerialService";
import type { RetailProduct, RetailScope } from "../../types";

export default function AddSerialToCartDialog({
  product,
  scope,
  excluded,
  onClose,
  onConfirm,
}: {
  product: RetailProduct;
  scope?: RetailScope;
  excluded: string[];
  onClose: () => void;
  onConfirm: (serial: string) => void;
}) {
  const [items, setItems] = React.useState<InventorySerialUnit[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState("");

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setSelected("");
    setItems([]);
    setError("");
    const load = async () => {
      const units: InventorySerialUnit[] = [];
      let page = 1;
      while (active) {
        const result = await inventorySerialService.list({
          ...scope,
          productId: product.productId || product._id,
          variantId: product.variantId,
          forSale: true,
          status: "in_stock",
          page,
          limit: 100,
        });
        units.push(...result.items);
        if (!result.items.length || units.length >= result.total) break;
        page += 1;
      }
      if (active) setItems(units);
    };
    void load()
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Không thể tải IMEI / Serial.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [product._id, product.productId, product.variantId, scope?.companyCode, scope?.branchId]);

  const available = items.filter(
    (item) => item.normalizedSerialNumber && !excluded.includes(item.normalizedSerialNumber),
  );
  const filtered = available.filter((item) =>
    `${item.serialNumber} ${item.internalBarcode}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const canConfirm =
    !loading && !error && available.some((item) => item.normalizedSerialNumber === selected);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chọn IMEI / Serial để thêm vào giỏ"
        className="flex max-h-[90vh] w-full min-w-0 max-w-[460px] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl"
      >
        {/* COMPACT HEADER */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 bg-slate-50/50">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#dce9ff]/70 text-[#0758d5]">
              <ScanBarcode className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-800 leading-tight">Chọn IMEI / Serial</h3>
              <p className="text-[11px] text-slate-500">Chọn 1 máy để thêm vào giỏ hàng</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* DIALOG BODY */}
        <div className="flex min-h-0 flex-1 flex-col space-y-2.5 overflow-hidden p-4">
          {/* PRODUCT BANNER (COMPACT) */}
          <div className="shrink-0 rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-bold text-slate-800" title={product.name}>
                {product.name}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-slate-500">
                SKU: {product.sku}
              </span>
            </div>
          </div>

          {/* SEARCH INPUT (COMPACT) */}
          <div className="relative shrink-0">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              autoFocus
              aria-label="Tìm IMEI / Serial"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm IMEI, serial hoặc mã vạch..."
              className="w-full min-w-0 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#0866f5] focus:ring-1 focus:ring-[#0866f5]/20"
            />
          </div>

          {/* STATUS COUNT BAR */}
          {!loading && !error && (
            <div className="flex shrink-0 items-center justify-between px-0.5 text-xs">
              <span className="text-[11px] font-medium text-slate-500">
                {filtered.length} máy khả dụng
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${
                  canConfirm
                    ? "bg-[#dce9ff] text-[#0844a8] font-bold"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                Đã chọn {canConfirm ? 1 : 0}/1
              </span>
            </div>
          )}

          {/* LOADING STATE */}
          {loading && (
            <div
              role="status"
              className="flex flex-1 items-center justify-center gap-2 py-8 text-xs text-slate-500"
            >
              <Loader2 className="h-4 w-4 animate-spin text-[#0866f5]" aria-hidden="true" />
              Đang tải IMEI / Serial...
            </div>
          )}

          {/* ERROR STATE */}
          {error && (
            <div
              role="alert"
              className="flex shrink-0 items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="break-words">{error}</span>
            </div>
          )}

          {/* SCROLLABLE LIST OF SERIALS (TIGHT, COMPACT ROWS) */}
          <div className="flex-1 min-h-[140px] max-h-[320px] overflow-y-auto space-y-1.5 pr-0.5 scrollbar-thin">
            {filtered.map((item) => {
              const checked = selected === item.normalizedSerialNumber;
              return (
                <label
                  key={item._id}
                  className={`flex cursor-pointer items-center justify-between gap-2.5 rounded-lg border px-3 py-2 text-xs transition select-none ${
                    checked
                      ? "border-[#0866f5] bg-[#edf3ff]/70 shadow-2xs font-semibold ring-1 ring-[#0866f5]/30"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <input
                      type="radio"
                      name="add-cart-serial"
                      aria-label={item.serialNumber}
                      checked={checked}
                      onChange={() => setSelected(item.normalizedSerialNumber)}
                      className="h-3.5 w-3.5 shrink-0 accent-[#0866f5] cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-xs font-bold text-slate-800">
                        {item.serialNumber}
                      </span>
                      {item.internalBarcode && (
                        <span className="block truncate font-mono text-[10px] text-slate-400">
                          Mã vạch: {item.internalBarcode}
                        </span>
                      )}
                    </div>
                  </div>

                  {checked && (
                    <Check className="h-4 w-4 shrink-0 text-[#0866f5]" aria-hidden="true" />
                  )}
                </label>
              );
            })}

            {!loading && !error && !filtered.length && (
              <div className="flex flex-col items-center justify-center py-8 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-center">
                <ScanBarcode className="mb-1.5 h-6 w-6 text-slate-300" aria-hidden="true" />
                <p className="text-xs text-slate-500">Không có IMEI / Serial khả dụng phù hợp.</p>
              </div>
            )}
          </div>
        </div>

        {/* COMPACT FOOTER */}
        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-slate-50/40 px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => {
              if (canConfirm) onConfirm(selected);
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0866f5] px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#0758d5] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer shadow-xs shadow-[#0866f5]/20 active:scale-98"
          >
            <ShoppingCart className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Thêm vào giỏ
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
