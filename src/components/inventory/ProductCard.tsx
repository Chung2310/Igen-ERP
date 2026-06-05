import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle } from "lucide-react";
import { ProductItem } from "../../types";

export function ProductCard({ product }: { product: ProductItem }) {
  const alertState = product.stock <= product.minStockAlert;

  return (
    <div className={`relative flex flex-col justify-between rounded-2xl border bg-white p-5 transition-all hover:shadow-md ${alertState ? "border-red-200 bg-red-50/10 shadow-xs" : "border-gray-200"}`}>
      {alertState && (
        <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full border border-red-100 bg-red-50 px-2 py-0.5 font-mono text-[9px] font-bold text-red-500">
          <AlertTriangle className="h-3 w-3" />
          HẾT HÀNG / THIẾU
        </span>
      )}
      <div className="text-left">
        <span className="my-2 inline-flex h-12 min-w-12 items-center justify-center rounded-lg border bg-gray-50 px-3 font-mono text-sm font-bold text-slate-700 select-none">{product.imageUrl}</span>
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
    </div>
  );
}
