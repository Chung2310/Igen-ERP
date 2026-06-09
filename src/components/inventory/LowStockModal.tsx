import React from "react";
import { X } from "lucide-react";
import { ProductItem } from "../../types";

type Props = {
  products: ProductItem[];
  onClose: () => void;
};

export function LowStockModal({ products, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex animate-fadeIn items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-gray-200/50 bg-white font-sans shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 p-6">
          <div>
            <h4 className="text-base font-bold text-gray-800">Sản phẩm sắp hết (cảnh báo tồn kho)</h4>
            <p className="mt-1 text-xs text-gray-400">Danh sách các sản phẩm có tồn kho nhỏ hơn hoặc bằng ngưỡng cảnh báo.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1 text-sm font-bold text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-650">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          {products.length === 0 ? (
            <p className="text-sm text-gray-500">Không có sản phẩm sắp hết.</p>
          ) : (
            <table className="w-full table-auto text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="pb-3">SKU</th>
                  <th className="pb-3">Tên sản phẩm</th>
                  <th className="pb-3">Kho</th>
                  <th className="pb-3">Ngưỡng</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="py-3 font-mono text-xs text-gray-700">{p.sku}</td>
                    <td className="py-3 text-gray-800">{p.name}</td>
                    <td className="py-3 font-mono text-gray-800">{p.stock}</td>
                    <td className="py-3 font-mono text-gray-500">{p.minStockAlert}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 p-4">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 font-bold">Đóng</button>
        </div>
      </div>
    </div>
  );
}

export default LowStockModal;
