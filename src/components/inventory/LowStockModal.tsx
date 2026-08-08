import React from "react";
import { X } from "lucide-react";
import { ProductItem } from "../../types";

type Props = {
  products: ProductItem[];
  onClose: () => void;
};

export function LowStockModal({ products, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-100 bg-white font-sans shadow-2xl animate-scale-in max-h-[90dvh] overscroll-contain">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-6">
          <div>
            <h4 className="text-base font-bold text-slate-800">Sản phẩm sắp hết (cảnh báo tồn kho)</h4>
            <p className="mt-1 text-xs text-slate-400">Danh sách các sản phẩm có tồn kho nhỏ hơn hoặc bằng ngưỡng cảnh báo.</p>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="rounded-full p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-650"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          {products.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Không có sản phẩm sắp hết.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    <th className="p-4">Mã sản phẩm</th>
                    <th className="p-4">Tên sản phẩm</th>
                    <th className="p-4">Kho</th>
                    <th className="p-4">Ngưỡng cảnh báo</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/50">
                      <td className="p-4 font-sans text-xs font-bold text-slate-700">{p.sku}</td>
                      <td className="p-4 text-slate-800 font-semibold">{p.name}</td>
                      <td className="p-4 font-sans tabular-nums font-bold text-rose-600">{p.stock}</td>
                      <td className="p-4 font-sans tabular-nums text-slate-500">{p.minStockAlert}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 p-4">
          <button 
            onClick={onClose} 
            className="rounded-lg border border-slate-200 bg-white px-5 py-2 font-bold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

export default LowStockModal;
