import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle, Pencil, Trash2 } from "lucide-react";
import { ProductItem } from "../../types";

type ProductCardProps = {
  product: ProductItem;
  onDelete: (product: ProductItem) => void;
  onEdit: (product: ProductItem) => void;
};

export function formatCurrencyCompact(value: number): string {
  if (value >= 1e9) {
    return `${(value / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} triệu`;
  }
  return value.toLocaleString("vi-VN");
}

export function ProductCard({ product, onDelete, onEdit }: ProductCardProps) {
  const alertState = product.stock <= product.minStockAlert;
  const compactPrice = formatCurrencyCompact(product.price);
  const formattedPrice = product.price.toLocaleString("vi-VN");
  const formattedStock = product.stock.toLocaleString("vi-VN");

  return (
    <div
      className={`relative flex h-full flex-col justify-between rounded-xl border bg-white p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-md ${
        product.status === "Inactive"
          ? "border-gray-200 bg-gray-50/50 opacity-80"
          : alertState
            ? "border-red-200 bg-red-50/10 shadow-xs"
            : "border-gray-200"
      }`}
    >
      {product.status === "Inactive" ? (
        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-gray-250 bg-gray-100 px-2 py-0.5 font-mono text-[9px] font-bold text-gray-550 shadow-xs">
          Ngừng bán
        </span>
      ) : alertState ? (
        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-red-100 bg-red-50 px-2 py-0.5 font-mono text-[9px] font-bold text-red-500">
          <AlertTriangle className="h-3 w-3" />
          Thiếu hàng
        </span>
      ) : null}

      <div className="text-left">
        <div className="mb-2.5 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-28 w-full object-cover" />
          ) : (
            <div className="flex h-28 items-center justify-center bg-slate-100 px-4 text-center text-sm font-semibold text-slate-500">
              Chưa có ảnh
            </div>
          )}
        </div>

        <p className="font-mono text-[10px] tracking-wide text-gray-400">Mã sản phẩm: {product.sku}</p>
        <h4 className="mt-1.5 line-clamp-2 min-h-10 text-[13px] font-bold leading-5 text-slate-800">{product.name}</h4>
        
        <div className="mt-2 flex flex-wrap gap-1.5 items-center">
          <span className="inline-flex max-w-full rounded-md bg-blue-50 border border-blue-100/50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
            {product.category}
          </span>
          {product.brand && (
            <span className="inline-flex max-w-full rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
              {product.brand}
            </span>
          )}
        </div>

        {product.description && (
          <p className="mt-2 line-clamp-1 text-[11px] text-gray-450 italic" title={product.description}>
            {product.description}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-x-2 gap-y-1.5 border-t border-gray-100 pt-3">
        <div className="min-w-0 flex-1 text-left">
          <p className="font-mono text-[10px] text-gray-450">Đơn giá</p>
          <p className="font-mono text-[13px] font-bold text-indigo-600 truncate" title={`${formattedPrice} đ`}>
            {compactPrice} đ
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-[10px] text-gray-450">Tồn kho</p>
          <p className={`font-mono text-[13px] font-bold ${alertState && product.status !== "Inactive" ? "text-red-500" : "text-slate-700"} truncate`} title={`${formattedStock} ${product.unit || "chiếc"}`}>
            {formattedStock} {product.unit || "chiếc"}
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-gray-50 pt-2.5 text-[11px]">
        <span className="font-mono text-gray-400">AI</span>
        <span
          className={`flex items-center gap-1 font-semibold ${
            product.demandForecast === "Tăng mạnh"
              ? "text-red-500"
              : product.demandForecast === "Ổn định"
                ? "text-green-600"
                : "text-amber-600"
          }`}
        >
          {product.demandForecast === "Giảm nhẹ" ? (
            <ArrowDownRight className="h-3.5 w-3.5" />
          ) : product.demandForecast === "Ổn định" ? (
            <CheckCircle className="h-3.5 w-3.5" />
          ) : (
            <ArrowUpRight className="h-3.5 w-3.5" />
          )}
          {product.demandForecast}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={() => onEdit(product)}
          className="flex items-center gap-1 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-700 transition-colors hover:bg-blue-100"
        >
          <Pencil className="h-3.5 w-3.5" />
          Sửa
        </button>
        <button
          type="button"
          onClick={() => onDelete(product)}
          className="flex items-center gap-1 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 transition-colors hover:bg-red-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Xóa
        </button>
      </div>
    </div>
  );
}
