import React from "react";
import { Headphones, Package, SlidersHorizontal, Smartphone, Tablet } from "lucide-react";
import { Dropdown } from "../../../../components/common/Dropdown";
import { toast } from "../../../../pages/Toast";
import type { RetailProduct } from "../../types";

const money = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(value) + " ₫";

export type ProductGroup = { key: string; name: string; variants: RetailProduct[] };

export function groupProductsBySku(products: RetailProduct[]): ProductGroup[] {
  const groups = new Map<string, ProductGroup>();
  for (const product of products) {
    const key = product.productId || product._id;
    const suffix = product.variantName ? ` - ${product.variantName}` : "";
    const baseName =
      suffix && product.name.endsWith(suffix)
        ? product.name.slice(0, -suffix.length)
        : product.name;
    const existing = groups.get(key);
    if (existing) existing.variants.push(product);
    else groups.set(key, { key, name: baseName, variants: [product] });
  }
  return Array.from(groups.values());
}

export function DeviceCategoryIcon({ name, category }: { name: string; category?: string }) {
  const text = `${name} ${category || ""}`.toLowerCase();
  if (
    text.includes("tai nghe") ||
    text.includes("airpods") ||
    text.includes("headphone") ||
    text.includes("earphone") ||
    text.includes("củ sạc") ||
    text.includes("sạc") ||
    text.includes("cáp") ||
    text.includes("ốp")
  ) {
    return <Headphones className="h-8 w-8 text-[#6b8fd6] group-hover:text-[#0866f5] transition" />;
  }
  if (
    text.includes("máy tính bảng") ||
    text.includes("tablet") ||
    text.includes("ipad") ||
    text.includes("galaxy tab")
  ) {
    return <Tablet className="h-8 w-8 text-[#6b8fd6] group-hover:text-[#0866f5] transition" />;
  }
  if (
    text.includes("iphone") ||
    text.includes("galaxy") ||
    text.includes("redmi") ||
    text.includes("điện thoại") ||
    text.includes("phone") ||
    text.includes("xiaomi") ||
    text.includes("oppo") ||
    text.includes("samsung")
  ) {
    return <Smartphone className="h-8 w-8 text-[#6b8fd6] group-hover:text-[#0866f5] transition" />;
  }
  return <Package className="h-8 w-8 text-[#6b8fd6] group-hover:text-[#0866f5] transition" />;
}

export interface ProductCardProps {
  group: ProductGroup;
  onAdd: (product: RetailProduct) => void;
  onOpenVariantSelector?: (group: ProductGroup) => void;
}

export function ProductCard({
  group,
  onAdd,
  onOpenVariantSelector,
}: ProductCardProps) {
  const defaultId = (
    group.variants.find((variant) => variant.stock > 0) || group.variants[0]
  )._id;
  const [selectedId, setSelectedId] = React.useState(defaultId);
  const [failedImageUrl, setFailedImageUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!group.variants.some((variant) => variant._id === selectedId))
      setSelectedId(defaultId);
  }, [group.variants, selectedId, defaultId]);

  const selected =
    group.variants.find((variant) => variant._id === selectedId) ||
    group.variants[0];
  const totalStock = group.variants.reduce(
    (sum, variant) => sum + Math.max(0, variant.stock),
    0,
  );
  const isSoldOut = selected.stock <= 0;
  const minPrice = Math.min(...group.variants.map((v) => v.price));
  const maxPrice = Math.max(...group.variants.map((v) => v.price));

  return (
    <div className="group relative flex flex-col justify-between rounded-xl border border-[#dce6f7] bg-white p-3 text-left transition hover:border-[#6b9dff] hover:shadow-md shadow-2xs">
      <button
        type="button"
        aria-label={`${group.name} SKU: ${selected.sku} Tồn: ${selected.stock} ${money(selected.price)}`}
        className={`flex w-full min-w-0 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0866f5] rounded-lg cursor-pointer ${
          isSoldOut ? "opacity-75" : ""
        }`}
        onClick={() => {
          if (group.variants.length > 1 && onOpenVariantSelector) {
            onOpenVariantSelector(group);
            return;
          }
          if (selected.stock <= 0) {
            toast.error(`${selected.name} không còn đủ tồn khả dụng.`);
            return;
          }
          onAdd(selected);
        }}
      >
        {/* Device Icon / Image Box */}
        <div className="relative flex h-24 sm:h-28 w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#f3f7ff] to-[#f7f3ff] border border-[#e7edfa] overflow-hidden group-hover:from-[#edf3ff] group-hover:to-[#f5f0ff] transition">
          {selected.imageUrl && selected.imageUrl !== failedImageUrl ? (
            <img
              src={selected.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-contain p-2 transition group-hover:scale-105"
              onError={() => setFailedImageUrl(selected.imageUrl!)}
            />
          ) : (
            <DeviceCategoryIcon name={group.name} category={selected.category} />
          )}

          {isSoldOut ? (
            <span className="absolute top-2 right-2 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
              Hết hàng
            </span>
          ) : selected.stock <= 2 ? (
            <span className="absolute top-2 right-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              Tồn: {selected.stock}
            </span>
          ) : null}
        </div>

        {/* Product Details */}
        <div className="mt-2.5 min-w-0 flex-1">
          <span
            title={group.name}
            className="block truncate text-sm font-bold text-slate-900 group-hover:text-[#0758d5] transition"
          >
            {group.name}
          </span>

          <p className="mt-1 text-xs sm:text-sm font-extrabold text-[#0866f5] tabular-nums">
            {group.variants.length > 1 && minPrice !== maxPrice
              ? `Từ ${money(minPrice)}`
              : money(selected.price)}
          </p>

          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span className="truncate font-mono">
              {group.variants.length > 1
                ? `${group.variants.length} phân loại`
                : `SKU: ${selected.sku}`}
            </span>
            <span
              className={`shrink-0 font-medium ${
                isSoldOut
                  ? "text-rose-600"
                  : selected.stock <= 2
                  ? "text-amber-600"
                  : "text-slate-500"
              }`}
            >
              Tồn: {selected.stock}
            </span>
          </div>
        </div>
      </button>

      {/* Dropdown for multiple SKUs/variants using project's common Dropdown component */}
      {group.variants.length > 1 && (
        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5">
          <div className="flex-1 min-w-0">
            <Dropdown
              aria-label={`Chọn SKU cho ${group.name}`}
              placeholder={`${group.variants.length} SKU · Tổng tồn: ${totalStock}`}
              value=""
              onChange={(variantId) => {
                const v = group.variants.find((item) => item._id === variantId);
                if (v) {
                  if (v.stock <= 0) {
                    toast.error(`${v.name} không còn đủ tồn khả dụng.`);
                    return;
                  }
                  setSelectedId(v._id);
                  onAdd(v);
                }
              }}
              options={group.variants.map((variant) => ({
                value: variant._id,
                label: `${variant.variantName || variant.sku} · ${money(variant.price)} · Tồn: ${variant.stock}`,
                disabled: variant.stock <= 0,
              }))}
              variant="filter"
              size="xs"
              className="w-full"
              triggerClassName="w-full text-xs font-normal"
            />
          </div>
          {onOpenVariantSelector && (
            <button
              type="button"
              aria-label={`Mở bảng chọn chi tiết SKU cho ${group.name}`}
              onClick={() => onOpenVariantSelector(group)}
              className="shrink-0 p-1.5 rounded-lg border border-slate-200 hover:border-[#0866f5] hover:bg-[#edf3ff] text-slate-500 hover:text-[#0866f5] transition cursor-pointer"
              title="Mở bảng chọn chi tiết SKU"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ProductCard;
