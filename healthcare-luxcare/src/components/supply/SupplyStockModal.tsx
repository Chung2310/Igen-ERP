import React, { useState } from "react";
import { ArrowDownRight, ArrowUpRight, X, Package, Search } from "lucide-react";
import type { SupplyItem } from "../../types/supply";

interface Props {
  isOpen: boolean;
  type: "in" | "out" | null;
  supply: SupplyItem | null;
  suppliesList?: SupplyItem[];
  onSelectSupply?: (item: SupplyItem | null) => void;
  quantity: number;
  setQuantity: (q: number) => void;
  reason: string;
  setReason: (r: string) => void;
  recipient: string;
  setRecipient: (rc: string) => void;
  batch: string;
  setBatch: (b: string) => void;
  expiry: string;
  setExpiry: (e: string) => void;
  actionLoading: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const SupplyStockModal: React.FC<Props> = ({
  isOpen,
  type,
  supply,
  suppliesList = [],
  onSelectSupply,
  quantity,
  setQuantity,
  reason,
  setReason,
  recipient,
  setRecipient,
  batch,
  setBatch,
  expiry,
  setExpiry,
  actionLoading,
  onClose,
  onSubmit,
}) => {
  const [searchSupply, setSearchSupply] = useState("");

  if (!isOpen || !type) return null;

  const filteredSupplies = suppliesList.filter((s) => {
    const q = searchSupply.toLowerCase().trim();
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 border border-slate-100 text-left"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            {type === "in" ? (
              <>
                <ArrowDownRight className="w-5 h-5 text-emerald-600" />
                {supply ? `Nhập kho: ${supply.name}` : "Tạo phiếu Nhập kho"}
              </>
            ) : (
              <>
                <ArrowUpRight className="w-5 h-5 text-amber-600" />
                {supply ? `Xuất dùng: ${supply.name}` : "Tạo phiếu Xuất kho"}
              </>
            )}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nếu chưa chọn vật tư thì cho chọn từ danh sách */}
        {!supply ? (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Chọn vật tư y tế <span className="text-rose-500 font-bold ml-0.5">*</span>
            </label>
            <select
              required
              value=""
              onChange={(e) => {
                const found = suppliesList.find((s) => s._id === e.target.value);
                if (found && onSelectSupply) onSelectSupply(found);
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
            >
              <option value="" disabled>
                -- Chọn vật tư ({type === "out" ? "chỉ xuất được vật tư còn hàng" : "toàn bộ danh mục"}) --
              </option>
              {filteredSupplies.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.code}) - Tồn: {s.quantity} {s.unit}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-1">
            <p>
              Mã vật tư: <span className="font-mono font-bold text-slate-800">{supply.code}</span>
            </p>
            <p>
              Tồn kho hiện tại:{" "}
              <span className="font-bold text-emerald-700">
                {supply.quantity} {supply.unit}
              </span>
            </p>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Số lượng {type === "in" ? "nhập thêm" : "xuất dùng"} {supply?.unit ? `(${supply.unit})` : ""}{" "}
            <span className="text-rose-500 font-bold ml-0.5">*</span>
          </label>
          <input
            type="number"
            required
            min={1}
            max={type === "out" && supply ? supply.quantity : undefined}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-base font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        {type === "out" && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Khoa / Phòng tiếp nhận <span className="text-rose-500 font-bold ml-0.5">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="vd: Khoa Cấp cứu, Phòng Khám số 2..."
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        )}

        {type === "in" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Số lô mới (nếu có)
              </label>
              <input
                type="text"
                placeholder={supply?.batchNumber || "vd: LOT-2026-B"}
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hạn dùng mới
              </label>
              <input
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Lý do / Mục đích <span className="text-rose-500 font-bold ml-0.5">*</span>
          </label>
          <textarea
            required
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={type === "in" ? "vd: Nhập hàng định kỳ từ nhà cung cấp" : "vd: Xuất dùng điều trị bệnh nhân..."}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={actionLoading || !supply}
            className={`px-4 py-2 rounded-xl text-white text-sm font-semibold transition cursor-pointer disabled:opacity-50 ${
              type === "in"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-amber-600 hover:bg-amber-700"
            }`}
          >
            {actionLoading ? "Đang xử lý..." : type === "in" ? "Xác nhận Nhập kho" : "Xác nhận Xuất kho"}
          </button>
        </div>
      </form>
    </div>
  );
};
