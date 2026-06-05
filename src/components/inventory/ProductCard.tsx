import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle, Pencil, Trash2 } from "lucide-react";
import { ProductItem } from "../../types";

type ProductCardProps = {
  product: ProductItem;
  onDelete: (product: ProductItem) => void;
  onEdit: (product: ProductItem) => void;
};

export function ProductCard({ product, onDelete, onEdit }: ProductCardProps) {
  const alertState = product.stock <= product.minStockAlert;

  return (
    <div className={`relative flex flex-col justify-between rounded-2xl border bg-white p-5 transition-all hover:shadow-md ${alertState ? "border-red-200 bg-red-50/10 shadow-xs" : "border-gray-200"}`}>
      {alertState && (
        <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full border border-red-100 bg-red-50 px-2 py-0.5 font-mono text-[9px] font-bold text-red-500">
          <AlertTriangle className="h-3 w-3" />
          Hết hàng / thiếu
        </span>
      )}

      <div className="text-left">
        <div className="mb-3 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-40 w-full object-cover" />
          ) : (
            <div className="flex h-40 items-center justify-center bg-slate-100 px-4 text-center font-semibold text-slate-500">
              Chưa có ảnh sản phẩm
            </div>
          )}
        </div>
        <p className="mt-1 font-mono text-[10px] tracking-wider text-gray-400">SKU: {product.sku}</p>
        <h4 className="mt-2 font-sans text-sm font-bold leading-snug tracking-tight text-slate-800">{product.name}</h4>
        <span className="mt-2 inline-block rounded-md bg-slate-100 px-2.5 py-0.5 text-[9px] font-medium text-gray-500">{product.category}</span>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
        <div>
          <p className="font-mono text-[10px] text-gray-400">Đơn giá định mức:</p>
          <p className="font-mono text-sm font-bold text-indigo-600">{product.price.toLocaleString("vi-VN")} đ</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] text-gray-400">Tồn kho:</p>
          <p className={`font-mono text-sm font-bold ${alertState ? "text-red-500" : "text-gray-700"}`}>{product.stock} chiếc</p>
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-between border-t border-gray-50 pt-2.5 text-[11px]">
        <span className="font-mono text-gray-400">Xu hướng AI:</span>
        <span className={`flex items-center gap-1 font-semibold ${product.demandForecast === "Tăng mạnh" ? "text-red-500" : product.demandForecast === "Ổn định" ? "text-green-600" : "text-amber-600"}`}>
          {product.demandForecast === "Giảm nhẹ" ? <ArrowDownRight className="h-3.5 w-3.5" /> : product.demandForecast === "Ổn định" ? <CheckCircle className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
          {product.demandForecast}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
        <button type="button" onClick={() => onEdit(product)} className="flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-700 transition-colors hover:bg-blue-100">
          <Pencil className="h-3.5 w-3.5" />
          Sửa
        </button>
        <button type="button" onClick={() => onDelete(product)} className="flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700 transition-colors hover:bg-red-100">
          <Trash2 className="h-3.5 w-3.5" />
          Xóa
        </button>
      </div>
    </div>
  );
}
